import { describe, expect, it, vi } from "vitest";
import {
  applyChangePage,
  applyMutationResults,
  deleteLocalRecordDraft,
  type LocalSyncDatabase,
  listLocalRecordDrafts,
  listReadyMutations,
  queueChildProfileUpdate,
  queueEmergencyCardUpdate,
  queueRecordUpsert,
  readLocalRecordDraft,
  saveLocalRecordDraft,
} from "./repository";

const childId = "019f742b-de82-7292-86cd-5475a1388313";
const mutationId = "019f742b-de82-7292-86cd-5475a1388314";
const dependencyId = "019f742b-de82-7292-86cd-5475a1388315";
const idempotencyKey = "019f742b-de82-7292-86cd-5475a1388316";
const cardId = "019f742b-de82-7292-86cd-5475a1388317";
const recordId = "019f742b-de82-7292-86cd-5475a1388318";
const versionId = "019f742b-de82-7292-86cd-5475a1388319";
const recordContent = {
  details: {
    documentKind: { state: "confirmed" as const, value: "Synthetic discharge summary" },
    schema: "document.v1" as const,
  },
  notes: { state: "notProvided" as const },
  providerFacility: { state: "confirmed" as const, value: "Synthetic Clinic" },
  schemaVersion: 1 as const,
  title: "Synthetic visit record",
};
const emergencyContent = {
  allergies: { state: "noneConfirmed" as const },
  bloodGroup: { state: "confirmed" as const, value: "O+" },
  criticalNotes: { state: "notProvided" as const },
  dateOfBirth: "2020-01-01",
  guardianContacts: [
    { name: "Synthetic Guardian", phone: "+919999999999", relationship: "Parent" },
  ],
  pediatrician: { state: "notProvided" as const },
  preferredName: "Synthetic Child",
  urgentMedications: { state: "noneConfirmed" as const },
};

function scriptedDatabase(input: {
  readonly all?: ReadonlyArray<unknown>;
  readonly first?: ReadonlyArray<unknown>;
}) {
  const all = [...(input.all ?? [])];
  const first = [...(input.first ?? [])];
  const runAsync = vi.fn(
    async (_sql: string, ..._params: Array<string | number | null>) => undefined,
  );
  const database: LocalSyncDatabase = {
    async getAllAsync<T>() {
      return (all.shift() ?? []) as ReadonlyArray<T>;
    },
    async getFirstAsync<T>() {
      return (first.shift() ?? null) as T | null;
    },
    runAsync,
    async withTransactionAsync(task) {
      await task();
    },
  };
  return { database, runAsync };
}

describe("OFF-04 local repository", () => {
  it("commits an optimistic child edit and ordered mutation together", async () => {
    const scripted = scriptedDatabase({ first: [{ revision: 3 }] });
    await queueChildProfileUpdate(scripted.database, {
      childId,
      idempotencyKey,
      localDependencyIds: [dependencyId],
      mutationId,
      now: "2026-07-22T12:00:00.000Z",
      payload: { dateOfBirth: "2020-01-01", preferredName: "Local Synthetic Edit" },
    });

    expect(scripted.runAsync).toHaveBeenCalledTimes(2);
    expect(scripted.runAsync.mock.calls[0]?.[0]).toContain("insert into local_mutations");
    expect(scripted.runAsync.mock.calls[0]).toEqual(
      expect.arrayContaining([mutationId, childId, 3, idempotencyKey]),
    );
    expect(scripted.runAsync.mock.calls[1]?.[0]).toContain("sync_status = 'pending'");
  });

  it("dispatches only due mutations whose dependencies completed", async () => {
    const scripted = scriptedDatabase({
      all: [
        [
          {
            attempts: 0,
            baseRevision: 1,
            dependencyIdsJson: "[]",
            entityId: childId,
            idempotencyKey,
            mutationId: dependencyId,
            nextAttemptAt: null,
            payloadJson: JSON.stringify({
              dateOfBirth: "2020-01-01",
              preferredName: "First",
            }),
            status: "applied",
          },
          {
            attempts: 1,
            baseRevision: 2,
            dependencyIdsJson: JSON.stringify([dependencyId]),
            entityId: childId,
            idempotencyKey,
            mutationId,
            nextAttemptAt: "2026-07-22T11:59:00.000Z",
            payloadJson: JSON.stringify({
              dateOfBirth: "2020-01-01",
              preferredName: "Second",
            }),
            status: "retrying",
          },
        ],
      ],
    });

    await expect(
      listReadyMutations(scripted.database, {
        limit: 50,
        now: "2026-07-22T12:00:00.000Z",
      }),
    ).resolves.toMatchObject([{ mutationId, status: "retrying" }]);
  });

  it("preserves the local proposal and stores the server copy on conflict", async () => {
    const localPayload = JSON.stringify({
      dateOfBirth: "2020-01-01",
      preferredName: "Local Synthetic Edit",
    });
    const scripted = scriptedDatabase({
      first: [
        {
          attempts: 1,
          baseRevision: 1,
          dependencyIdsJson: "[]",
          entityId: childId,
          idempotencyKey,
          mutationId,
          nextAttemptAt: null,
          payloadJson: localPayload,
          status: "pushing",
        },
      ],
    });

    await applyMutationResults(
      scripted.database,
      [
        {
          current: {
            childId,
            dateOfBirth: "2020-01-01",
            preferredName: "Remote Synthetic Edit",
            revision: 2,
            updatedAt: "2026-07-22T12:00:00.000Z",
          },
          entityId: childId,
          mutationId,
          reason: "staleCriticalRevision",
          status: "conflict",
        },
      ],
      "2026-07-22T12:01:00.000Z",
    );

    expect(
      scripted.runAsync.mock.calls.some((call) => String(call[0]).includes("local_conflicts")),
    ).toBe(true);
    const conflictInsert = scripted.runAsync.mock.calls.find((call) =>
      String(call[0]).includes("local_conflicts"),
    );
    expect(conflictInsert).toEqual(expect.arrayContaining([localPayload]));
    expect(JSON.stringify(scripted.runAsync.mock.calls)).toContain("Remote Synthetic Edit");
  });

  it("lets a tombstone remove a clean row but preserves pending work for review", async () => {
    const clean = scriptedDatabase({ first: [null] });
    await applyChangePage(clean.database, {
      changes: [
        {
          changedAt: "2026-07-22T12:00:00.000Z",
          entityId: childId,
          operation: "delete",
          revision: 4,
        },
      ],
      householdId: childId,
      nextCursor: "synthetic-cursor",
      now: "2026-07-22T12:00:00.000Z",
    });
    expect(
      clean.runAsync.mock.calls.some((call) =>
        String(call[0]).includes("delete from local_children"),
      ),
    ).toBe(true);

    const pending = scriptedDatabase({
      first: [{ mutationId, payloadJson: '{"preferredName":"Local"}' }],
    });
    await applyChangePage(pending.database, {
      changes: [
        {
          changedAt: "2026-07-22T12:00:00.000Z",
          entityId: childId,
          operation: "delete",
          revision: 4,
        },
      ],
      householdId: childId,
      nextCursor: "synthetic-cursor",
      now: "2026-07-22T12:00:00.000Z",
    });
    expect(JSON.stringify(pending.runAsync.mock.calls)).toContain("tombstoneWins");
    expect(
      pending.runAsync.mock.calls.some((call) =>
        String(call[0]).includes("delete from local_children"),
      ),
    ).toBe(false);
  });
});

describe("OFF-05 local emergency-card repository", () => {
  it("commits a new card and create mutation together", async () => {
    const scripted = scriptedDatabase({ first: [null] });
    await queueEmergencyCardUpdate(scripted.database, {
      cardId,
      childId,
      content: emergencyContent,
      idempotencyKey,
      localDependencyIds: [],
      mutationId,
      now: "2026-07-22T12:00:00.000Z",
    });

    expect(scripted.runAsync).toHaveBeenCalledTimes(2);
    expect(scripted.runAsync.mock.calls[0]).toEqual(
      expect.arrayContaining([mutationId, cardId, "create", null]),
    );
    expect(String(scripted.runAsync.mock.calls[1]?.[0])).toContain("local_emergency_cards");
  });

  it("preserves local and authoritative emergency-card versions on conflict", async () => {
    const localPayload = JSON.stringify({
      accessMode: "standard",
      childId,
      content: emergencyContent,
    });
    const scripted = scriptedDatabase({
      first: [
        {
          attempts: 1,
          baseRevision: 1,
          dependencyIdsJson: "[]",
          entityId: cardId,
          entityType: "emergencyCard",
          idempotencyKey,
          mutationId,
          nextAttemptAt: null,
          operation: "update",
          payloadJson: localPayload,
          status: "pushing",
        },
      ],
    });

    await applyMutationResults(
      scripted.database,
      [
        {
          current: {
            accessMode: "standard",
            cardId,
            childId,
            content: {
              ...emergencyContent,
              criticalNotes: { state: "confirmed", values: ["Synthetic remote note"] },
            },
            revision: 2,
            updatedAt: "2026-07-22T12:01:00.000Z",
            version: 2,
          },
          entityId: cardId,
          mutationId,
          reason: "staleCriticalRevision",
          status: "conflict",
        },
      ],
      "2026-07-22T12:02:00.000Z",
    );

    expect(JSON.stringify(scripted.runAsync.mock.calls)).toContain("local_emergency_cards");
    expect(JSON.stringify(scripted.runAsync.mock.calls)).toContain("Synthetic remote note");
    expect(scripted.runAsync.mock.calls.some((call) => call.includes(localPayload))).toBe(true);
  });
});

describe("VLT-01 local record repository", () => {
  it("queues a manual record and projects its provisional Timeline entry atomically", async () => {
    const scripted = scriptedDatabase({ first: [null] });

    await queueRecordUpsert(scripted.database, {
      category: "document",
      childId,
      content: recordContent,
      eventAt: "2026-07-20T09:00:00.000Z",
      idempotencyKey,
      localDependencyIds: [],
      mutationId: versionId,
      now: "2026-07-22T12:00:00.000Z",
      recordId,
      sourceType: "manual",
    });

    expect(scripted.runAsync).toHaveBeenCalledTimes(4);
    expect(scripted.runAsync.mock.calls[0]).toEqual(
      expect.arrayContaining([versionId, recordId, "create", null]),
    );
    expect(String(scripted.runAsync.mock.calls[1]?.[0])).toContain("local_records");
    expect(String(scripted.runAsync.mock.calls[3]?.[0])).toContain("local_timeline_entries");
    expect(JSON.stringify(scripted.runAsync.mock.calls[3])).toContain("recordEventAt");
  });

  it("keeps the local correction and stores the authoritative record on conflict", async () => {
    const localPayload = JSON.stringify({
      category: "document",
      childId,
      content: { ...recordContent, title: "Synthetic local correction" },
      eventAt: "2026-07-20T09:00:00.000Z",
      sourceType: "manual",
    });
    const scripted = scriptedDatabase({
      first: [
        {
          attempts: 1,
          baseRevision: 1,
          dependencyIdsJson: "[]",
          entityId: recordId,
          entityType: "record",
          idempotencyKey,
          mutationId,
          nextAttemptAt: null,
          operation: "update",
          payloadJson: localPayload,
          status: "pushing",
        },
      ],
    });

    await applyMutationResults(
      scripted.database,
      [
        {
          current: {
            accessScope: "selectedHealthRecords",
            category: "document",
            childId,
            confirmationState: "confirmed",
            content: { ...recordContent, title: "Synthetic remote correction" },
            eventAt: "2026-07-20T09:00:00.000Z",
            provenance: { sourceType: "manual", trustedIssuer: false },
            recordId,
            revision: 2,
            updatedAt: "2026-07-22T12:01:00.000Z",
            version: 2,
            versionId,
          },
          entityId: recordId,
          mutationId,
          reason: "staleCriticalRevision",
          status: "conflict",
        },
      ],
      "2026-07-22T12:02:00.000Z",
    );

    expect(JSON.stringify(scripted.runAsync.mock.calls)).toContain("local_records");
    expect(JSON.stringify(scripted.runAsync.mock.calls)).toContain("Synthetic remote correction");
    expect(scripted.runAsync.mock.calls.some((call) => call.includes(localPayload))).toBe(true);
  });

  it("accepts generated Timeline entries only as server projections", async () => {
    const scripted = scriptedDatabase({ first: [null] });
    await applyChangePage(scripted.database, {
      changes: [
        {
          changedAt: "2026-07-22T12:00:00.000Z",
          entity: {
            childId,
            content: {
              category: "document",
              dateAuthority: "recordEventAt",
              title: "Synthetic visit record",
            },
            entryId: versionId,
            eventAt: "2026-07-20T09:00:00.000Z",
            recordId,
            revision: 1,
            sourceVersionId: versionId,
            updatedAt: "2026-07-22T12:00:00.000Z",
          },
          entityId: versionId,
          entityType: "timelineEntry",
          operation: "upsert",
          revision: 1,
        },
      ],
      householdId: childId,
      nextCursor: "synthetic-record-cursor",
      now: "2026-07-22T12:00:00.000Z",
    });

    expect(
      scripted.runAsync.mock.calls.some((call) =>
        String(call[0]).includes("insert into local_timeline_entries"),
      ),
    ).toBe(true);
  });
});

describe("VLT-02 local manual drafts", () => {
  it("stores, resumes, lists, and explicitly discards an encrypted form draft", async () => {
    const draft = {
      category: "prescription" as const,
      childId,
      draftId: recordId,
      formJson: JSON.stringify({ title: "Synthetic unfinished prescription" }),
      targetRecordId: null,
      updatedAt: "2026-07-24T12:00:00.000Z",
    };
    const scripted = scriptedDatabase({ all: [[draft]], first: [draft] });

    await saveLocalRecordDraft(scripted.database, draft);
    await expect(readLocalRecordDraft(scripted.database, recordId)).resolves.toEqual(draft);
    await expect(listLocalRecordDrafts(scripted.database, childId)).resolves.toEqual([draft]);
    await deleteLocalRecordDraft(scripted.database, recordId);

    expect(String(scripted.runAsync.mock.calls[0]?.[0])).toContain("local_record_drafts");
    expect(scripted.runAsync.mock.calls[0]).toEqual(
      expect.arrayContaining([recordId, childId, "prescription", draft.formJson]),
    );
    expect(String(scripted.runAsync.mock.calls[1]?.[0])).toContain(
      "delete from local_record_drafts",
    );
  });

  it("removes the source draft in the same transaction as confirmation", async () => {
    const scripted = scriptedDatabase({ first: [null] });
    await queueRecordUpsert(scripted.database, {
      category: "document",
      childId,
      content: recordContent,
      draftId: recordId,
      eventAt: null,
      idempotencyKey,
      localDependencyIds: [],
      mutationId,
      now: "2026-07-24T12:00:00.000Z",
      recordId,
      sourceType: "manual",
    });

    expect(scripted.runAsync).toHaveBeenCalledTimes(5);
    expect(String(scripted.runAsync.mock.calls[4]?.[0])).toContain(
      "delete from local_record_drafts",
    );
    expect(scripted.runAsync.mock.calls[4]).toEqual(expect.arrayContaining([recordId]));
  });
});
