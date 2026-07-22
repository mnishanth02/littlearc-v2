import { describe, expect, it, vi } from "vitest";
import {
  applyChangePage,
  applyMutationResults,
  type LocalSyncDatabase,
  listReadyMutations,
  queueChildProfileUpdate,
} from "./repository";

const childId = "019f742b-de82-7292-86cd-5475a1388313";
const mutationId = "019f742b-de82-7292-86cd-5475a1388314";
const dependencyId = "019f742b-de82-7292-86cd-5475a1388315";
const idempotencyKey = "019f742b-de82-7292-86cd-5475a1388316";

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
