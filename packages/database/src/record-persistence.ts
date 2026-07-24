import { createHash } from "node:crypto";
import type {
  EncryptedEnvelopeV1,
  StructuredPayloadCrypto,
  WrappedHouseholdKey,
} from "@littlearc/crypto";
import {
  assertRecordVersionContent,
  canArchiveOrDeleteRecord,
  canCorrectRecord,
  canCreateRecord,
  canReadRecord,
  type GeneratedRecordTimelineContent,
  type HouseholdCapability,
  type HouseholdRole,
  type RecordAccessScope,
  type RecordCategory,
  type RecordSourceType,
  type RecordVersionContentV1,
  recordAccessScopeForCategory,
  timelineEventForConfirmedRecord,
  type UuidV7,
} from "@littlearc/domain";
import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./client.js";

export type RecordProjection = {
  readonly accessScope: RecordAccessScope;
  readonly category: RecordCategory;
  readonly childId: UuidV7;
  readonly confirmationState: "confirmed" | "archived";
  readonly content: RecordVersionContentV1;
  readonly eventAt: string | null;
  readonly provenance: {
    readonly sourceType: RecordSourceType;
    readonly trustedIssuer: boolean;
  };
  readonly recordId: UuidV7;
  readonly revision: number;
  readonly updatedAt: string;
  readonly version: number;
  readonly versionId: UuidV7;
};

export type RecordVersionProjection = {
  readonly confirmedAt: string | null;
  readonly confirmationState: "draft" | "suggested" | "confirmed" | "archived";
  readonly content: RecordVersionContentV1;
  readonly createdAt: string;
  readonly provenance: {
    readonly sourceType: RecordSourceType;
    readonly trustedIssuer: boolean;
  };
  readonly recordId: UuidV7;
  readonly supersedesVersionId: UuidV7 | null;
  readonly version: number;
  readonly versionId: UuidV7;
};

export type GeneratedTimelineProjection = {
  readonly childId: UuidV7;
  readonly content: GeneratedRecordTimelineContent;
  readonly entryId: UuidV7;
  readonly eventAt: string;
  readonly recordId: UuidV7;
  readonly revision: number;
  readonly sourceVersionId: UuidV7;
  readonly updatedAt: string;
};

type RecordMutationPayload = {
  readonly category: RecordCategory;
  readonly childId: UuidV7;
  readonly content: RecordVersionContentV1;
  readonly eventAt: string | null;
  readonly sourceType: RecordSourceType;
};

export type RecordSyncMutation =
  | {
      readonly baseRevision: null;
      readonly entityId: UuidV7;
      readonly entityType: "record";
      readonly idempotencyKey: UuidV7;
      readonly localDependencyIds: ReadonlyArray<UuidV7>;
      readonly mutationId: UuidV7;
      readonly operation: "create";
      readonly payload: RecordMutationPayload;
    }
  | {
      readonly baseRevision: number;
      readonly entityId: UuidV7;
      readonly entityType: "record";
      readonly idempotencyKey: UuidV7;
      readonly localDependencyIds: ReadonlyArray<UuidV7>;
      readonly mutationId: UuidV7;
      readonly operation: "update";
      readonly payload: RecordMutationPayload;
    }
  | {
      readonly baseRevision: number;
      readonly entityId: UuidV7;
      readonly entityType: "record";
      readonly idempotencyKey: UuidV7;
      readonly localDependencyIds: ReadonlyArray<UuidV7>;
      readonly mutationId: UuidV7;
      readonly operation: "delete";
    };

export type RecordMutationOutcome =
  | {
      readonly entity: RecordProjection;
      readonly entityId: UuidV7;
      readonly mutationId: UuidV7;
      readonly status: "applied" | "duplicate";
    }
  | {
      readonly current: RecordProjection;
      readonly entityId: UuidV7;
      readonly mutationId: UuidV7;
      readonly reason: "staleCriticalRevision";
      readonly status: "conflict";
    }
  | {
      readonly entityId: UuidV7;
      readonly mutationId: UuidV7;
      readonly reason:
        | "authorizationDenied"
        | "dependencyFailed"
        | "dependencyMissing"
        | "idempotencyMismatch"
        | "tombstoneWins"
        | "validationFailed";
      readonly status: "rejected";
    };

export type RecordSyncContext = {
  readonly grantedCapabilities: ReadonlySet<HouseholdCapability>;
  readonly householdId: UuidV7;
  readonly membershipId: UuidV7;
  readonly role: HouseholdRole;
};

type SqlTransaction = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

type RecordDatabaseRow = {
  readonly accessScope: RecordAccessScope;
  readonly category: RecordCategory;
  readonly childId: UuidV7;
  readonly confirmationState: "confirmed" | "archived";
  readonly deletedAt: string | Date | null;
  readonly encryptedPayload: EncryptedEnvelopeV1;
  readonly eventAt: string | Date | null;
  readonly id: UuidV7;
  readonly provenanceType: RecordSourceType;
  readonly revision: number;
  readonly sourceIssuerId: UuidV7 | null;
  readonly updatedAt: string | Date;
  readonly versionId: UuidV7;
  readonly versionNumber: number;
};

type TimelineDatabaseRow = {
  readonly childId: UuidV7;
  readonly deletedAt: string | Date | null;
  readonly encryptedPayload: EncryptedEnvelopeV1;
  readonly eventAt: string | Date;
  readonly id: UuidV7;
  readonly revision: number;
  readonly sourceRecordId: UuidV7;
  readonly sourceVersionId: UuidV7;
  readonly updatedAt: string | Date;
};

export type RecordPersistence = {
  readonly mutate: (input: {
    readonly batchStatuses: ReadonlyMap<UuidV7, RecordMutationOutcome["status"]>;
    readonly identityUserId: string;
    readonly mutation: RecordSyncMutation;
  }) => Promise<RecordMutationOutcome>;
  readonly readRecord: (input: {
    readonly identityUserId: string;
    readonly recordId: UuidV7;
  }) => Promise<RecordProjection | null>;
  readonly readVersions: (input: {
    readonly identityUserId: string;
    readonly limit: number;
    readonly recordId: UuidV7;
    readonly beforeVersion?: number;
  }) => Promise<ReadonlyArray<RecordVersionProjection>>;
};

export function createRecordPersistence(options: {
  readonly crypto: StructuredPayloadCrypto;
  readonly database: DatabaseClient;
}): RecordPersistence {
  return {
    async mutate(input) {
      return persistRecordMutation(options, input);
    },
    async readRecord(input) {
      return options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        const row = await readRecordRow(transaction, context, input.recordId, false);
        if (!row || !canReadRecord(context, row.accessScope)) {
          return null;
        }
        const key = await readHouseholdKey(transaction, context.householdId);
        const plaintextKey = options.crypto.unwrapHouseholdKey(key);
        try {
          return projectRecord(options.crypto, context.householdId, row, plaintextKey);
        } finally {
          plaintextKey.fill(0);
        }
      });
    },
    async readVersions(input) {
      return options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        const record = await readRecordRow(transaction, context, input.recordId, false);
        if (!record || !canReadRecord(context, record.accessScope)) {
          return [];
        }
        const rows = await transaction.execute<{
          readonly confirmationState: RecordVersionProjection["confirmationState"];
          readonly confirmedAt: string | Date | null;
          readonly createdAt: string | Date;
          readonly encryptedPayload: EncryptedEnvelopeV1;
          readonly provenanceType: RecordSourceType;
          readonly sourceIssuerId: UuidV7 | null;
          readonly supersedesVersionId: UuidV7 | null;
          readonly versionId: UuidV7;
          readonly versionNumber: number;
        }>(sql`
          select
            id as "versionId",
            version_number as "versionNumber",
            encrypted_payload as "encryptedPayload",
            confirmation_state as "confirmationState",
            provenance_type as "provenanceType",
            source_issuer_id as "sourceIssuerId",
            confirmed_at as "confirmedAt",
            supersedes_version_id as "supersedesVersionId",
            created_at as "createdAt"
          from littlearc.record_versions
          where household_id = ${context.householdId}
            and record_id = ${input.recordId}
            and (${input.beforeVersion ?? null}::int is null
              or version_number < ${input.beforeVersion ?? null})
          order by version_number desc
          limit ${Math.min(Math.max(input.limit, 1), 51)}
        `);
        const key = await readHouseholdKey(transaction, context.householdId);
        const plaintextKey = options.crypto.unwrapHouseholdKey(key);
        try {
          return rows.rows.map((row) =>
            projectRecordVersion(
              options.crypto,
              context.householdId,
              input.recordId,
              row,
              plaintextKey,
            ),
          );
        } finally {
          plaintextKey.fill(0);
        }
      });
    },
  };
}

export async function readRecordsForSync(
  transaction: SqlTransaction,
  context: RecordSyncContext,
  recordIds: ReadonlyArray<UuidV7>,
): Promise<Map<UuidV7, RecordDatabaseRow>> {
  if (recordIds.length === 0) {
    return new Map();
  }
  const idList = sql.join(
    recordIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const rows = await transaction.execute<RecordDatabaseRow>(sql`
    select
      record.id,
      record.child_id as "childId",
      record.category,
      record.source_type as "provenanceType",
      record.confirmation_state as "confirmationState",
      record.event_at as "eventAt",
      record.access_scope as "accessScope",
      record.revision,
      record.updated_at as "updatedAt",
      record.deleted_at as "deletedAt",
      version.id as "versionId",
      version.version_number as "versionNumber",
      version.encrypted_payload as "encryptedPayload",
      version.source_issuer_id as "sourceIssuerId"
    from littlearc.records record
    join littlearc.record_versions version
      on version.household_id = record.household_id
      and version.record_id = record.id
      and version.id = record.current_version_id
    where record.household_id = ${context.householdId}
      and record.id in (${idList})
  `);
  return new Map(
    rows.rows.filter((row) => canReadRecord(context, row.accessScope)).map((row) => [row.id, row]),
  );
}

export async function readTimelineForSync(
  transaction: SqlTransaction,
  context: RecordSyncContext,
  entryIds: ReadonlyArray<UuidV7>,
): Promise<Map<UuidV7, TimelineDatabaseRow>> {
  if (entryIds.length === 0) {
    return new Map();
  }
  const idList = sql.join(
    entryIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const rows = await transaction.execute<
    TimelineDatabaseRow & { readonly accessScope: RecordAccessScope }
  >(sql`
    select
      entry.id,
      entry.child_id as "childId",
      entry.event_at as "eventAt",
      entry.source_record_id as "sourceRecordId",
      entry.source_version_id as "sourceVersionId",
      entry.encrypted_payload as "encryptedPayload",
      entry.revision,
      entry.updated_at as "updatedAt",
      entry.deleted_at as "deletedAt",
      record.access_scope as "accessScope"
    from littlearc.timeline_entries entry
    join littlearc.records record
      on record.household_id = entry.household_id
      and record.id = entry.source_record_id
    where entry.household_id = ${context.householdId}
      and entry.id in (${idList})
  `);
  return new Map(
    rows.rows.filter((row) => canReadRecord(context, row.accessScope)).map((row) => [row.id, row]),
  );
}

export function projectRecordForSync(
  crypto: StructuredPayloadCrypto,
  householdId: UuidV7,
  row: RecordDatabaseRow,
  plaintextKey: Buffer,
): RecordProjection {
  return projectRecord(crypto, householdId, row, plaintextKey);
}

export function projectTimelineForSync(
  crypto: StructuredPayloadCrypto,
  householdId: UuidV7,
  row: TimelineDatabaseRow,
  plaintextKey: Buffer,
): GeneratedTimelineProjection {
  const payload = crypto.decrypt(
    row.encryptedPayload,
    {
      aadSchemaVersion: 1,
      householdId,
      objectId: row.id,
      objectType: "timeline_entry",
    },
    plaintextKey,
  );
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The generated Timeline payload is invalid.");
  }
  const content = payload as GeneratedRecordTimelineContent;
  if (
    typeof content.title !== "string" ||
    !["recordEventAt", "confirmedAtFallback"].includes(content.dateAuthority)
  ) {
    throw new Error("The generated Timeline payload is invalid.");
  }
  return {
    childId: row.childId,
    content,
    entryId: row.id,
    eventAt: normalizeTimestamp(row.eventAt),
    recordId: row.sourceRecordId,
    revision: row.revision,
    sourceVersionId: row.sourceVersionId,
    updatedAt: normalizeTimestamp(row.updatedAt),
  };
}

async function persistRecordMutation(
  options: { readonly crypto: StructuredPayloadCrypto; readonly database: DatabaseClient },
  input: {
    readonly batchStatuses: ReadonlyMap<UuidV7, RecordMutationOutcome["status"]>;
    readonly identityUserId: string;
    readonly mutation: RecordSyncMutation;
  },
): Promise<RecordMutationOutcome> {
  return options.database.transaction(async (transaction) => {
    const context = await establishContext(transaction, input.identityUserId);
    const mutation = input.mutation;
    let requestFingerprint: string;
    try {
      if (mutation.operation !== "delete") {
        assertRecordVersionContent(mutation.payload.content);
        if (mutation.payload.sourceType !== "manual") {
          throw new Error("VLT-01 accepts manual synthetic records only.");
        }
        if (mutation.payload.eventAt !== null) {
          assertNormalizedTimestamp(mutation.payload.eventAt);
        }
      }
      requestFingerprint = fingerprint(mutation);
    } catch {
      return rejected(mutation, "validationFailed");
    }

    const replayResult = await transaction.execute<{
      readonly requestFingerprint: string;
      readonly responseBody: { readonly status: string };
    }>(sql`
      select
        request_fingerprint as "requestFingerprint",
        response_body as "responseBody"
      from littlearc.idempotency_results
      where household_id = ${context.householdId}
        and actor_id = ${context.membershipId}
        and idempotency_key = ${mutation.idempotencyKey}
    `);
    const replay = replayResult.rows[0];
    if (replay) {
      if (replay.requestFingerprint !== requestFingerprint) {
        return rejected(mutation, "idempotencyMismatch");
      }
      return replayRecordMutation(
        transaction,
        options.crypto,
        context,
        mutation,
        replay.responseBody.status,
      );
    }

    for (const dependencyId of mutation.localDependencyIds) {
      const status = input.batchStatuses.get(dependencyId);
      if (status) {
        if (status !== "applied" && status !== "duplicate") {
          return rejected(mutation, "dependencyFailed");
        }
        continue;
      }
      const dependency = await transaction.execute<{ readonly status: string }>(sql`
        select response_body->>'status' as status
        from littlearc.idempotency_results
        where household_id = ${context.householdId}
          and actor_id = ${context.membershipId}
          and mutation_id = ${dependencyId}
        limit 1
      `);
      if (!dependency.rows[0]) {
        return rejected(mutation, "dependencyMissing");
      }
      if (dependency.rows[0].status !== "applied") {
        return rejected(mutation, "dependencyFailed");
      }
    }

    const current = await readRecordForUpdate(transaction, context, mutation.entityId);
    if (mutation.operation === "create") {
      const accessScope = recordAccessScopeForCategory(mutation.payload.category);
      if (current || !canCreateRecord(context) || !canReadRecord(context, accessScope)) {
        return rejected(mutation, "authorizationDenied");
      }
      const child = await transaction.execute<{ readonly id: UuidV7 }>(sql`
        select id from littlearc.children
        where household_id = ${context.householdId}
          and id = ${mutation.payload.childId}
          and deleted_at is null
        limit 1
      `);
      if (!child.rows[0]) {
        return rejected(mutation, "authorizationDenied");
      }
      return createOrCorrectRecord(
        transaction,
        options.crypto,
        context,
        mutation,
        requestFingerprint,
        null,
      );
    }

    if (!current) {
      return rejected(mutation, "authorizationDenied");
    }
    if (current.deletedAt) {
      await persistTerminalResult(transaction, context, mutation, requestFingerprint, {
        status: "rejected",
      });
      return rejected(mutation, "tombstoneWins");
    }
    if (current.revision !== mutation.baseRevision) {
      const key = await readHouseholdKey(transaction, context.householdId);
      const plaintextKey = options.crypto.unwrapHouseholdKey(key);
      try {
        await persistTerminalResult(transaction, context, mutation, requestFingerprint, {
          status: "conflict",
        });
        await insertFailureAudit(transaction, context, mutation, "stale_critical_revision");
        return {
          current: projectRecord(options.crypto, context.householdId, current, plaintextKey),
          entityId: mutation.entityId,
          mutationId: mutation.mutationId,
          reason: "staleCriticalRevision",
          status: "conflict",
        };
      } finally {
        plaintextKey.fill(0);
      }
    }

    if (mutation.operation === "delete") {
      if (!canArchiveOrDeleteRecord(context)) {
        return rejected(mutation, "authorizationDenied");
      }
      return deleteRecord(
        transaction,
        options.crypto,
        context,
        mutation,
        requestFingerprint,
        current,
      );
    }

    if (
      !canCorrectRecord(context, current.accessScope) ||
      current.childId !== mutation.payload.childId ||
      current.category !== mutation.payload.category
    ) {
      return rejected(mutation, "authorizationDenied");
    }
    return createOrCorrectRecord(
      transaction,
      options.crypto,
      context,
      mutation,
      requestFingerprint,
      current,
    );
  });
}

async function createOrCorrectRecord(
  transaction: SqlTransaction,
  crypto: StructuredPayloadCrypto,
  context: RecordSyncContext,
  mutation: Extract<RecordSyncMutation, { readonly operation: "create" | "update" }>,
  requestFingerprint: string,
  current: RecordDatabaseRow | null,
): Promise<RecordMutationOutcome> {
  const nextRevision = (current?.revision ?? 0) + 1;
  const nextVersion = (current?.versionNumber ?? 0) + 1;
  const now = normalizeTimestamp(new Date());
  const timeline = timelineEventForConfirmedRecord({
    category: mutation.payload.category,
    confirmedAt: now,
    content: mutation.payload.content,
    eventAt: mutation.payload.eventAt,
  });
  const householdKey = await readHouseholdKey(transaction, context.householdId);
  const plaintextKey = crypto.unwrapHouseholdKey(householdKey);
  try {
    const recordEnvelope = crypto.encrypt(
      mutation.payload.content as unknown as Record<string, unknown>,
      {
        aadSchemaVersion: 1,
        householdId: context.householdId,
        objectId: mutation.mutationId,
        objectType: "record_version",
      },
      plaintextKey,
      householdKey.keyVersion,
    );
    const timelineEnvelope = crypto.encrypt(
      timeline.content as unknown as Record<string, unknown>,
      {
        aadSchemaVersion: 1,
        householdId: context.householdId,
        objectId: mutation.mutationId,
        objectType: "timeline_entry",
      },
      plaintextKey,
      householdKey.keyVersion,
    );

    if (!current) {
      await transaction.execute(sql`
        insert into littlearc.records (
          id, household_id, child_id, category, source_type,
          confirmation_state, event_at, access_scope, ai_assisted,
          created_by, updated_by, revision
        ) values (
          ${mutation.entityId}, ${context.householdId}, ${mutation.payload.childId},
          ${mutation.payload.category}, ${mutation.payload.sourceType}, 'confirmed',
          ${mutation.payload.eventAt}, ${recordAccessScopeForCategory(mutation.payload.category)},
          false, ${context.membershipId}, ${context.membershipId}, 1
        )
      `);
    } else {
      await transaction.execute(sql`
        update littlearc.timeline_entries
        set
          projection_state = 'inactive',
          revision = revision + 1,
          updated_by = ${context.membershipId},
          updated_at = now()
        where household_id = ${context.householdId}
          and source_record_id = ${mutation.entityId}
          and projection_state = 'active'
          and deleted_at is null
      `);
    }

    await transaction.execute(sql`
      insert into littlearc.record_versions (
        id, household_id, record_id, version_number, payload_schema_version,
        encrypted_payload, confirmation_state, provenance_type,
        confirmed_by, confirmed_at, supersedes_version_id, created_by
      ) values (
        ${mutation.mutationId}, ${context.householdId}, ${mutation.entityId},
        ${nextVersion}, 1, ${JSON.stringify(recordEnvelope)}::jsonb, 'confirmed',
        ${mutation.payload.sourceType}, ${context.membershipId}, ${now},
        ${current?.versionId ?? null}, ${context.membershipId}
      )
    `);

    const updated = await transaction.execute<RecordDatabaseRow>(sql`
      update littlearc.records
      set
        source_type = ${mutation.payload.sourceType},
        confirmation_state = 'confirmed',
        event_at = ${mutation.payload.eventAt},
        current_version_id = ${mutation.mutationId},
        revision = ${nextRevision},
        updated_by = ${context.membershipId},
        updated_at = now()
      where household_id = ${context.householdId}
        and id = ${mutation.entityId}
        and revision = ${current?.revision ?? 1}
        and deleted_at is null
      returning
        id,
        child_id as "childId",
        category,
        source_type as "provenanceType",
        confirmation_state as "confirmationState",
        event_at as "eventAt",
        access_scope as "accessScope",
        revision,
        updated_at as "updatedAt",
        deleted_at as "deletedAt",
        ${mutation.mutationId}::uuid as "versionId",
        ${nextVersion}::int as "versionNumber",
        ${JSON.stringify(recordEnvelope)}::jsonb as "encryptedPayload",
        null::uuid as "sourceIssuerId"
    `);
    const row = updated.rows[0];
    if (!row) {
      throw new Error("The record revision changed while applying the mutation.");
    }

    await transaction.execute(sql`
      insert into littlearc.timeline_entries (
        id, household_id, child_id, entry_type, event_at,
        source_record_id, source_version_id, encrypted_payload,
        visibility, projection_state, created_by, updated_by, revision
      ) values (
        ${mutation.mutationId}, ${context.householdId}, ${mutation.payload.childId},
        'record', ${timeline.eventAt}, ${mutation.entityId}, ${mutation.mutationId},
        ${JSON.stringify(timelineEnvelope)}::jsonb, 'household', 'active',
        ${context.membershipId}, ${context.membershipId}, 1
      )
    `);

    await transaction.execute(sql`
      insert into littlearc.audit_events (
        id, household_id, actor_id, actor_role, action, target_type,
        target_id, request_id, result, metadata
      ) values (
        ${mutation.mutationId}, ${context.householdId}, ${context.membershipId},
        ${context.role}, ${current ? "record_updated" : "record_created"},
        'record', ${mutation.entityId}, ${mutation.mutationId}, 'success',
        ${JSON.stringify({
          fromRevision: current?.revision ?? null,
          schemaVersion: 1,
          toRevision: nextRevision,
          version: nextVersion,
        })}::jsonb
      )
    `);

    if (current) {
      await transaction.execute(sql`
        insert into littlearc.change_events (
          household_id, entity_type, entity_id, operation, revision,
          actor_id, mutation_id, payload
        ) values (
          ${context.householdId}, 'timelineEntry', ${current.versionId}, 'delete',
          2, ${context.membershipId}, ${mutation.mutationId},
          ${JSON.stringify({ schemaVersion: 1 })}::jsonb
        )
      `);
    }
    await transaction.execute(sql`
      insert into littlearc.change_events (
        household_id, entity_type, entity_id, operation, revision,
        actor_id, mutation_id, payload
      ) values
        (
          ${context.householdId}, 'record', ${mutation.entityId}, 'upsert',
          ${nextRevision}, ${context.membershipId}, ${mutation.mutationId},
          ${JSON.stringify({ schemaVersion: 1, version: nextVersion })}::jsonb
        ),
        (
          ${context.householdId}, 'timelineEntry', ${mutation.mutationId}, 'upsert',
          1, ${context.membershipId}, ${mutation.mutationId},
          ${JSON.stringify({ schemaVersion: 1, sourceVersion: nextVersion })}::jsonb
        )
    `);
    await transaction.execute(sql`
      insert into littlearc.outbox_events (
        id, household_id, event_type, aggregate_type, aggregate_id, payload
      ) values (
        ${mutation.mutationId}, ${context.householdId}, 'record_version_confirmed',
        'record', ${mutation.entityId},
        ${JSON.stringify({ revision: nextRevision, schemaVersion: 1, version: nextVersion })}::jsonb
      )
    `);
    await persistTerminalResult(transaction, context, mutation, requestFingerprint, {
      status: "applied",
    });
    return {
      entity: projectRecord(crypto, context.householdId, row, plaintextKey),
      entityId: mutation.entityId,
      mutationId: mutation.mutationId,
      status: "applied",
    };
  } finally {
    plaintextKey.fill(0);
  }
}

async function deleteRecord(
  transaction: SqlTransaction,
  crypto: StructuredPayloadCrypto,
  context: RecordSyncContext,
  mutation: Extract<RecordSyncMutation, { readonly operation: "delete" }>,
  requestFingerprint: string,
  current: RecordDatabaseRow,
): Promise<RecordMutationOutcome> {
  const householdKey = await readHouseholdKey(transaction, context.householdId);
  const plaintextKey = crypto.unwrapHouseholdKey(householdKey);
  try {
    const projection = projectRecord(crypto, context.householdId, current, plaintextKey);
    const nextRevision = current.revision + 1;
    const timeline = await transaction.execute<{
      readonly id: UuidV7;
      readonly revision: number;
    }>(sql`
      update littlearc.timeline_entries
      set
        projection_state = 'tombstoned',
        revision = revision + 1,
        updated_by = ${context.membershipId},
        updated_at = now(),
        deleted_at = now()
      where household_id = ${context.householdId}
        and source_record_id = ${mutation.entityId}
        and projection_state = 'active'
        and deleted_at is null
      returning id, revision
    `);
    await transaction.execute(sql`
      update littlearc.records
      set
        revision = ${nextRevision},
        updated_by = ${context.membershipId},
        updated_at = now(),
        deleted_at = now()
      where household_id = ${context.householdId}
        and id = ${mutation.entityId}
        and revision = ${current.revision}
        and deleted_at is null
    `);
    await transaction.execute(sql`
      insert into littlearc.audit_events (
        id, household_id, actor_id, actor_role, action, target_type,
        target_id, request_id, result, metadata
      ) values (
        ${mutation.mutationId}, ${context.householdId}, ${context.membershipId},
        ${context.role}, 'record_deleted', 'record', ${mutation.entityId},
        ${mutation.mutationId}, 'success',
        ${JSON.stringify({
          fromRevision: current.revision,
          toRevision: nextRevision,
          version: current.versionNumber,
        })}::jsonb
      )
    `);
    await transaction.execute(sql`
      insert into littlearc.change_events (
        household_id, entity_type, entity_id, operation, revision,
        actor_id, mutation_id, payload
      ) values (
        ${context.householdId}, 'record', ${mutation.entityId}, 'delete',
        ${nextRevision}, ${context.membershipId}, ${mutation.mutationId},
        ${JSON.stringify({ schemaVersion: 1 })}::jsonb
      )
    `);
    const timelineRow = timeline.rows[0];
    if (timelineRow) {
      await transaction.execute(sql`
        insert into littlearc.change_events (
          household_id, entity_type, entity_id, operation, revision,
          actor_id, mutation_id, payload
        ) values (
          ${context.householdId}, 'timelineEntry', ${timelineRow.id}, 'delete',
          ${timelineRow.revision}, ${context.membershipId}, ${mutation.mutationId},
          ${JSON.stringify({ schemaVersion: 1 })}::jsonb
        )
      `);
    }
    await transaction.execute(sql`
      insert into littlearc.outbox_events (
        id, household_id, event_type, aggregate_type, aggregate_id, payload
      ) values (
        ${mutation.mutationId}, ${context.householdId}, 'record.purge_requested',
        'record', ${mutation.entityId},
        ${JSON.stringify({ revision: nextRevision, schemaVersion: 1 })}::jsonb
      )
    `);
    await persistTerminalResult(transaction, context, mutation, requestFingerprint, {
      status: "applied",
    });
    return {
      entity: projection,
      entityId: mutation.entityId,
      mutationId: mutation.mutationId,
      status: "applied",
    };
  } finally {
    plaintextKey.fill(0);
  }
}

async function replayRecordMutation(
  transaction: SqlTransaction,
  crypto: StructuredPayloadCrypto,
  context: RecordSyncContext,
  mutation: RecordSyncMutation,
  status: string,
): Promise<RecordMutationOutcome> {
  const row = await readRecordRow(transaction, context, mutation.entityId, true);
  if (!row) {
    return rejected(mutation, "tombstoneWins");
  }
  const key = await readHouseholdKey(transaction, context.householdId);
  const plaintextKey = crypto.unwrapHouseholdKey(key);
  try {
    const projection = projectRecord(crypto, context.householdId, row, plaintextKey);
    if (status === "applied") {
      return {
        entity: projection,
        entityId: mutation.entityId,
        mutationId: mutation.mutationId,
        status: "duplicate",
      };
    }
    if (status === "conflict") {
      return {
        current: projection,
        entityId: mutation.entityId,
        mutationId: mutation.mutationId,
        reason: "staleCriticalRevision",
        status: "conflict",
      };
    }
    return rejected(mutation, "tombstoneWins");
  } finally {
    plaintextKey.fill(0);
  }
}

async function establishContext(
  transaction: SqlTransaction,
  identityUserId: string,
): Promise<RecordSyncContext> {
  await transaction.execute(sql`set local role littlearc_app`);
  await transaction.execute(
    sql`select set_config('littlearc.current_identity_user_id', ${identityUserId}, true)`,
  );
  const membership = await transaction.execute<{
    readonly householdId: UuidV7;
    readonly membershipId: UuidV7;
    readonly role: HouseholdRole;
  }>(sql`
    select household_id as "householdId", id as "membershipId", role
    from littlearc.household_memberships
    where user_id = ${identityUserId} and status = 'active'
    limit 1
  `);
  const context = membership.rows[0];
  if (!context) {
    throw new Error("An active household membership is required.");
  }
  await transaction.execute(sql`
    select
      set_config('littlearc.current_household_id', ${context.householdId}, true),
      set_config('littlearc.current_actor_id', ${context.membershipId}, true),
      set_config('littlearc.current_actor_role', ${context.role}, true),
      set_config('littlearc.current_identity_user_id', ${identityUserId}, true)
  `);
  const capabilities = await transaction.execute<{ readonly capability: HouseholdCapability }>(sql`
    select capability
    from littlearc.membership_capabilities
    where household_id = ${context.householdId}
      and membership_id = ${context.membershipId}
      and revoked_at is null
  `);
  return {
    ...context,
    grantedCapabilities: new Set(capabilities.rows.map((row) => row.capability)),
  };
}

async function readRecordForUpdate(
  transaction: SqlTransaction,
  context: RecordSyncContext,
  recordId: UuidV7,
): Promise<RecordDatabaseRow | null> {
  const row = await readRecordRow(transaction, context, recordId, true, true);
  return row ?? null;
}

async function readRecordRow(
  transaction: SqlTransaction,
  context: RecordSyncContext,
  recordId: UuidV7,
  includeDeleted: boolean,
  forUpdate = false,
): Promise<RecordDatabaseRow | undefined> {
  const result = await transaction.execute<RecordDatabaseRow>(sql`
    select
      record.id,
      record.child_id as "childId",
      record.category,
      record.source_type as "provenanceType",
      record.confirmation_state as "confirmationState",
      record.event_at as "eventAt",
      record.access_scope as "accessScope",
      record.revision,
      record.updated_at as "updatedAt",
      record.deleted_at as "deletedAt",
      version.id as "versionId",
      version.version_number as "versionNumber",
      version.encrypted_payload as "encryptedPayload",
      version.source_issuer_id as "sourceIssuerId"
    from littlearc.records record
    join littlearc.record_versions version
      on version.household_id = record.household_id
      and version.record_id = record.id
      and version.id = record.current_version_id
    where record.household_id = ${context.householdId}
      and record.id = ${recordId}
      and (${includeDeleted} or record.deleted_at is null)
    ${forUpdate ? sql`for update of record` : sql``}
  `);
  return result.rows[0];
}

async function readHouseholdKey(
  transaction: SqlTransaction,
  householdId: UuidV7,
): Promise<WrappedHouseholdKey> {
  const result = await transaction.execute<WrappedHouseholdKey>(sql`
    select
      key_version as "keyVersion",
      wrap_nonce as "wrapNonce",
      wrapped_key as "wrappedKey",
      wrapping_key_version as "wrappingKeyVersion"
    from littlearc.household_keys
    where household_id = ${householdId} and status = 'active'
    order by key_version desc
    limit 1
  `);
  const key = result.rows[0];
  if (!key) {
    throw new Error("The household encryption key is unavailable.");
  }
  return key;
}

function projectRecord(
  crypto: StructuredPayloadCrypto,
  householdId: UuidV7,
  row: RecordDatabaseRow,
  plaintextKey: Buffer,
): RecordProjection {
  const payload = crypto.decrypt(
    row.encryptedPayload,
    {
      aadSchemaVersion: 1,
      householdId,
      objectId: row.versionId,
      objectType: "record_version",
    },
    plaintextKey,
  ) as RecordVersionContentV1;
  assertRecordVersionContent(payload);
  return {
    accessScope: row.accessScope,
    category: row.category,
    childId: row.childId,
    confirmationState: row.confirmationState,
    content: payload,
    eventAt: row.eventAt === null ? null : normalizeTimestamp(row.eventAt),
    provenance: {
      sourceType: row.provenanceType,
      trustedIssuer: row.sourceIssuerId !== null,
    },
    recordId: row.id,
    revision: row.revision,
    updatedAt: normalizeTimestamp(row.updatedAt),
    version: row.versionNumber,
    versionId: row.versionId,
  };
}

function projectRecordVersion(
  crypto: StructuredPayloadCrypto,
  householdId: UuidV7,
  recordId: UuidV7,
  row: {
    readonly confirmationState: RecordVersionProjection["confirmationState"];
    readonly confirmedAt: string | Date | null;
    readonly createdAt: string | Date;
    readonly encryptedPayload: EncryptedEnvelopeV1;
    readonly provenanceType: RecordSourceType;
    readonly sourceIssuerId: UuidV7 | null;
    readonly supersedesVersionId: UuidV7 | null;
    readonly versionId: UuidV7;
    readonly versionNumber: number;
  },
  plaintextKey: Buffer,
): RecordVersionProjection {
  const payload = crypto.decrypt(
    row.encryptedPayload,
    {
      aadSchemaVersion: 1,
      householdId,
      objectId: row.versionId,
      objectType: "record_version",
    },
    plaintextKey,
  ) as RecordVersionContentV1;
  assertRecordVersionContent(payload);
  return {
    confirmedAt: row.confirmedAt === null ? null : normalizeTimestamp(row.confirmedAt),
    confirmationState: row.confirmationState,
    content: payload,
    createdAt: normalizeTimestamp(row.createdAt),
    provenance: {
      sourceType: row.provenanceType,
      trustedIssuer: row.sourceIssuerId !== null,
    },
    recordId,
    supersedesVersionId: row.supersedesVersionId,
    version: row.versionNumber,
    versionId: row.versionId,
  };
}

async function persistTerminalResult(
  transaction: SqlTransaction,
  context: RecordSyncContext,
  mutation: RecordSyncMutation,
  requestFingerprint: string,
  responseBody: { readonly status: string },
): Promise<void> {
  await transaction.execute(sql`
    insert into littlearc.idempotency_results (
      household_id, actor_id, idempotency_key, mutation_id,
      request_fingerprint, response_status, response_body, expires_at
    ) values (
      ${context.householdId}, ${context.membershipId}, ${mutation.idempotencyKey},
      ${mutation.mutationId}, ${requestFingerprint}, 200,
      ${JSON.stringify(responseBody)}::jsonb, now() + interval '24 hours'
    )
  `);
}

async function insertFailureAudit(
  transaction: SqlTransaction,
  context: RecordSyncContext,
  mutation: RecordSyncMutation,
  failureCode: string,
): Promise<void> {
  await transaction.execute(sql`
    insert into littlearc.audit_events (
      id, household_id, actor_id, actor_role, action, target_type,
      target_id, request_id, result, failure_code, metadata
    ) values (
      ${mutation.mutationId}, ${context.householdId}, ${context.membershipId},
      ${context.role}, 'record_updated', 'record', ${mutation.entityId},
      ${mutation.mutationId}, 'failure', ${failureCode},
      ${JSON.stringify({ submittedBaseRevision: mutation.baseRevision })}::jsonb
    )
  `);
}

function fingerprint(mutation: RecordSyncMutation): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        baseRevision: mutation.baseRevision,
        entityId: mutation.entityId,
        entityType: mutation.entityType,
        idempotencyKey: mutation.idempotencyKey,
        localDependencyIds: mutation.localDependencyIds,
        mutationId: mutation.mutationId,
        operation: mutation.operation,
        payload: "payload" in mutation ? mutation.payload : null,
      }),
    )
    .digest("hex")}`;
}

function rejected(
  mutation: RecordSyncMutation,
  reason: Extract<RecordMutationOutcome, { readonly status: "rejected" }>["reason"],
): RecordMutationOutcome {
  return {
    entityId: mutation.entityId,
    mutationId: mutation.mutationId,
    reason,
    status: "rejected",
  };
}

function assertNormalizedTimestamp(value: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new Error("The record event time must be a normalized UTC timestamp.");
  }
}

function normalizeTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
