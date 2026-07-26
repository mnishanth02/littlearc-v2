import {
  assertConsumerRecordSource,
  assertRecordContentForCategory,
  assertVaccinationDateMeaning,
  dependencyReadiness,
  type EmergencyCardContent,
  type GeneratedRecordTimelineContent,
  type LocalMutationStatus,
  parseMutationId,
  type RecordAccessScope,
  type RecordCategory,
  type RecordSourceType,
  type RecordVersionContentV1,
} from "@littlearc/domain";

export type LocalSyncDatabase = {
  readonly getAllAsync: <T>(
    sql: string,
    ...params: Array<string | number | null>
  ) => Promise<ReadonlyArray<T>>;
  readonly getFirstAsync: <T>(
    sql: string,
    ...params: Array<string | number | null>
  ) => Promise<T | null>;
  readonly runAsync: (sql: string, ...params: Array<string | number | null>) => Promise<unknown>;
  readonly withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
};

export type ChildProfile = {
  readonly childId: string;
  readonly dateOfBirth: string;
  readonly preferredName: string;
  readonly revision: number;
  readonly updatedAt: string;
};

export type LocalChildProfile = ChildProfile & {
  readonly deletedAt: string | null;
  readonly syncStatus: "conflict" | "pending" | "rejected" | "synced";
};

export type EmergencyCard = {
  readonly accessMode: "standard";
  readonly cardId: string;
  readonly childId: string;
  readonly content: EmergencyCardContent;
  readonly revision: number;
  readonly updatedAt: string;
  readonly version: number;
};

export type LocalEmergencyCard = EmergencyCard & {
  readonly deletedAt: string | null;
  readonly syncStatus: "conflict" | "pending" | "rejected" | "synced";
};

export type RecordProjection = {
  readonly accessScope: RecordAccessScope;
  readonly category: RecordCategory;
  readonly childId: string;
  readonly confirmationState: "draft" | "suggested" | "confirmed" | "archived";
  readonly content: RecordVersionContentV1;
  readonly eventAt: string | null;
  readonly provenance: {
    readonly sourceType: RecordSourceType;
    readonly trustedIssuer: boolean;
  };
  readonly recordId: string;
  readonly revision: number;
  readonly updatedAt: string;
  readonly version: number;
  readonly versionId: string;
};

export type LocalRecordProjection = RecordProjection & {
  readonly deletedAt: string | null;
  readonly syncStatus: "conflict" | "pending" | "rejected" | "synced";
};

export type LocalRecordDraft = {
  readonly category: Extract<
    RecordCategory,
    "document" | "vaccination" | "doctor_visit" | "prescription"
  >;
  readonly childId: string;
  readonly draftId: string;
  readonly formJson: string;
  readonly targetRecordId: string | null;
  readonly updatedAt: string;
};

export type RecordVersionProjection = {
  readonly confirmedAt: string | null;
  readonly confirmationState: RecordProjection["confirmationState"];
  readonly content: RecordVersionContentV1;
  readonly createdAt: string;
  readonly provenance: RecordProjection["provenance"];
  readonly recordId: string;
  readonly supersedesVersionId: string | null;
  readonly version: number;
  readonly versionId: string;
};

export type TimelineProjection = {
  readonly childId: string;
  readonly content: GeneratedRecordTimelineContent;
  readonly entryId: string;
  readonly eventAt: string;
  readonly recordId: string;
  readonly revision: number;
  readonly sourceVersionId: string;
  readonly updatedAt: string;
};

export type QueuedChildMutation = {
  readonly attempts: number;
  readonly baseRevision: number;
  readonly entityId: string;
  readonly entityType?: "child";
  readonly idempotencyKey: string;
  readonly localDependencyIds: ReadonlyArray<string>;
  readonly mutationId: string;
  readonly nextAttemptAt: string | null;
  readonly operation?: "update";
  readonly payload: {
    readonly dateOfBirth: string;
    readonly preferredName: string;
  };
  readonly status: LocalMutationStatus;
};

export type QueuedEmergencyCardMutation = {
  readonly attempts: number;
  readonly baseRevision: number | null;
  readonly entityId: string;
  readonly entityType: "emergencyCard";
  readonly idempotencyKey: string;
  readonly localDependencyIds: ReadonlyArray<string>;
  readonly mutationId: string;
  readonly nextAttemptAt: string | null;
  readonly operation: "create" | "update";
  readonly payload: {
    readonly accessMode: "standard";
    readonly childId: string;
    readonly content: EmergencyCardContent;
  };
  readonly status: LocalMutationStatus;
};

export type QueuedRecordMutation = {
  readonly attempts: number;
  readonly baseRevision: number | null;
  readonly entityId: string;
  readonly entityType: "record";
  readonly idempotencyKey: string;
  readonly localDependencyIds: ReadonlyArray<string>;
  readonly mutationId: string;
  readonly nextAttemptAt: string | null;
  readonly operation: "create" | "update" | "delete";
  readonly payload?: {
    readonly category: RecordCategory;
    readonly childId: string;
    readonly content: RecordVersionContentV1;
    readonly eventAt: string | null;
    readonly sourceType: RecordSourceType;
  };
  readonly status: LocalMutationStatus;
};

export type QueuedMutation =
  | QueuedChildMutation
  | QueuedEmergencyCardMutation
  | QueuedRecordMutation;

export type RemoteChange =
  | {
      readonly changedAt: string;
      readonly entity: ChildProfile;
      readonly entityId: string;
      readonly entityType?: "child";
      readonly operation: "upsert";
      readonly revision: number;
    }
  | {
      readonly changedAt: string;
      readonly entityId: string;
      readonly entityType?: "child";
      readonly operation: "delete";
      readonly revision: number;
    }
  | {
      readonly changedAt: string;
      readonly entity: EmergencyCard;
      readonly entityId: string;
      readonly entityType: "emergencyCard";
      readonly operation: "upsert";
      readonly revision: number;
    }
  | {
      readonly changedAt: string;
      readonly entityId: string;
      readonly entityType: "emergencyCard";
      readonly operation: "delete";
      readonly revision: number;
    }
  | {
      readonly changedAt: string;
      readonly entity: RecordProjection;
      readonly entityId: string;
      readonly entityType: "record";
      readonly operation: "upsert";
      readonly revision: number;
    }
  | {
      readonly changedAt: string;
      readonly entityId: string;
      readonly entityType: "record";
      readonly operation: "delete";
      readonly revision: number;
    }
  | {
      readonly changedAt: string;
      readonly entity: TimelineProjection;
      readonly entityId: string;
      readonly entityType: "timelineEntry";
      readonly operation: "upsert";
      readonly revision: number;
    }
  | {
      readonly changedAt: string;
      readonly entityId: string;
      readonly entityType: "timelineEntry";
      readonly operation: "delete";
      readonly revision: number;
    };

export type MutationResult =
  | {
      readonly entity: ChildProfile | EmergencyCard | RecordProjection;
      readonly entityId: string;
      readonly mutationId: string;
      readonly status: "applied" | "duplicate";
    }
  | {
      readonly current: ChildProfile | EmergencyCard | RecordProjection;
      readonly entityId: string;
      readonly mutationId: string;
      readonly reason: "staleCriticalRevision";
      readonly status: "conflict";
    }
  | {
      readonly entityId: string;
      readonly mutationId: string;
      readonly reason: string;
      readonly status: "rejected";
    };

export async function readLocalChildProfile(
  database: LocalSyncDatabase,
  childId: string,
): Promise<LocalChildProfile | null> {
  const row = await database.getFirstAsync<LocalChildRow>(
    `select
      child_id as "childId",
      revision,
      payload_json as "payloadJson",
      updated_at as "updatedAt",
      deleted_at as "deletedAt",
      sync_status as "syncStatus"
    from local_children
    where child_id = ?`,
    childId,
  );
  return row ? localChild(row) : null;
}

export async function readLocalEmergencyCard(
  database: LocalSyncDatabase,
  cardId: string,
): Promise<LocalEmergencyCard | null> {
  const row = await database.getFirstAsync<LocalEmergencyCardRow>(
    `select
      card_id as "cardId",
      child_id as "childId",
      revision,
      version,
      access_mode as "accessMode",
      payload_json as "payloadJson",
      updated_at as "updatedAt",
      deleted_at as "deletedAt",
      sync_status as "syncStatus"
    from local_emergency_cards
    where card_id = ?`,
    cardId,
  );
  return row ? localEmergencyCard(row) : null;
}

export async function readLocalRecord(
  database: LocalSyncDatabase,
  recordId: string,
): Promise<LocalRecordProjection | null> {
  const row = await database.getFirstAsync<LocalRecordRow>(
    `select
      record_id as "recordId",
      child_id as "childId",
      category,
      source_type as "sourceType",
      confirmation_state as "confirmationState",
      event_at as "eventAt",
      access_scope as "accessScope",
      revision,
      version,
      version_id as "versionId",
      payload_json as "payloadJson",
      updated_at as "updatedAt",
      deleted_at as "deletedAt",
      sync_status as "syncStatus"
    from local_records
    where record_id = ?`,
    recordId,
  );
  return row ? localRecord(row) : null;
}

export async function listLocalManualRecords(
  database: LocalSyncDatabase,
  childId: string,
): Promise<ReadonlyArray<LocalRecordProjection>> {
  const rows = await database.getAllAsync<LocalRecordRow>(
    `select
      record_id as "recordId",
      child_id as "childId",
      category,
      source_type as "sourceType",
      confirmation_state as "confirmationState",
      event_at as "eventAt",
      access_scope as "accessScope",
      revision,
      version,
      version_id as "versionId",
      payload_json as "payloadJson",
      updated_at as "updatedAt",
      deleted_at as "deletedAt",
      sync_status as "syncStatus"
    from local_records
    where child_id = ?
      and category in ('document', 'vaccination', 'doctor_visit', 'prescription')
      and deleted_at is null
    order by coalesce(event_at, updated_at) desc, record_id desc`,
    childId,
  );
  return rows.map(localRecord);
}

export async function readLocalRecordDraft(
  database: LocalSyncDatabase,
  draftId: string,
): Promise<LocalRecordDraft | null> {
  return database.getFirstAsync<LocalRecordDraft>(
    `select
      draft_id as "draftId",
      target_record_id as "targetRecordId",
      child_id as "childId",
      category,
      form_json as "formJson",
      updated_at as "updatedAt"
    from local_record_drafts
    where draft_id = ?`,
    draftId,
  );
}

export async function listLocalRecordDrafts(
  database: LocalSyncDatabase,
  childId: string,
): Promise<ReadonlyArray<LocalRecordDraft>> {
  return database.getAllAsync<LocalRecordDraft>(
    `select
      draft_id as "draftId",
      target_record_id as "targetRecordId",
      child_id as "childId",
      category,
      form_json as "formJson",
      updated_at as "updatedAt"
    from local_record_drafts
    where child_id = ?
    order by updated_at desc, draft_id desc`,
    childId,
  );
}

export async function saveLocalRecordDraft(
  database: LocalSyncDatabase,
  input: LocalRecordDraft,
): Promise<void> {
  await database.runAsync(
    `insert into local_record_drafts (
      draft_id, target_record_id, child_id, category, form_json, updated_at
    ) values (?, ?, ?, ?, ?, ?)
    on conflict(draft_id) do update set
      target_record_id = excluded.target_record_id,
      child_id = excluded.child_id,
      category = excluded.category,
      form_json = excluded.form_json,
      updated_at = excluded.updated_at`,
    input.draftId,
    input.targetRecordId,
    input.childId,
    input.category,
    input.formJson,
    input.updatedAt,
  );
}

export async function deleteLocalRecordDraft(
  database: LocalSyncDatabase,
  draftId: string,
): Promise<void> {
  await database.runAsync("delete from local_record_drafts where draft_id = ?", draftId);
}

export async function readLocalTimeline(
  database: LocalSyncDatabase,
  childId: string,
): Promise<ReadonlyArray<TimelineProjection>> {
  const rows = await database.getAllAsync<LocalTimelineRow>(
    `select
      entry_id as "entryId",
      child_id as "childId",
      record_id as "recordId",
      source_version_id as "sourceVersionId",
      event_at as "eventAt",
      payload_json as "payloadJson",
      revision,
      updated_at as "updatedAt"
    from local_timeline_entries
    where child_id = ? and deleted_at is null
    order by event_at desc, entry_id desc`,
    childId,
  );
  return rows.map(localTimeline);
}

export async function readLocalRecordVersions(
  database: LocalSyncDatabase,
  recordId: string,
): Promise<ReadonlyArray<RecordVersionProjection>> {
  const rows = await database.getAllAsync<LocalRecordVersionRow>(
    `select
      version_id as "versionId",
      record_id as "recordId",
      version,
      payload_json as "payloadJson",
      provenance_json as "provenanceJson",
      confirmed_at as "confirmedAt",
      created_at as "createdAt",
      supersedes_version_id as "supersedesVersionId"
    from local_record_versions
    where record_id = ?
    order by version desc`,
    recordId,
  );
  return rows.map(localRecordVersion);
}

export async function cacheRecordVersions(
  database: LocalSyncDatabase,
  versions: ReadonlyArray<RecordVersionProjection>,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    for (const version of versions) {
      await database.runAsync(
        `insert or replace into local_record_versions (
          version_id, record_id, version, payload_json, provenance_json,
          confirmed_at, created_at, supersedes_version_id
        ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
        version.versionId,
        version.recordId,
        version.version,
        JSON.stringify(version.content),
        JSON.stringify({
          confirmationState: version.confirmationState,
          ...version.provenance,
        }),
        version.confirmedAt,
        version.createdAt,
        version.supersedesVersionId,
      );
    }
  });
}

export async function queueRecordUpsert(
  database: LocalSyncDatabase,
  input: {
    readonly category: RecordCategory;
    readonly childId: string;
    readonly content: RecordVersionContentV1;
    readonly draftId?: string;
    readonly eventAt: string | null;
    readonly idempotencyKey: string;
    readonly localDependencyIds: ReadonlyArray<string>;
    readonly mutationId: string;
    readonly now: string;
    readonly recordId: string;
    readonly sourceType: RecordSourceType;
  },
): Promise<void> {
  assertConsumerRecordSource(input.sourceType);
  assertRecordContentForCategory(input.category, input.content);
  if (input.content.details.schema === "vaccination.v1") {
    assertVaccinationDateMeaning({ details: input.content.details, eventAt: input.eventAt });
  }
  await database.withTransactionAsync(async () => {
    const current = await database.getFirstAsync<{ readonly revision: number }>(
      "select revision from local_records where record_id = ? and deleted_at is null",
      input.recordId,
    );
    const operation = current ? "update" : "create";
    const baseRevision = current?.revision ?? null;
    const payload = {
      category: input.category,
      childId: input.childId,
      content: input.content,
      eventAt: input.eventAt,
      sourceType: input.sourceType,
    };
    await database.runAsync(
      `insert into local_mutations (
        mutation_id, entity_type, entity_id, operation, payload_json, status,
        created_at, base_revision, idempotency_key, dependency_ids_json,
        attempts, next_attempt_at, last_error_code, updated_at
      ) values (?, 'record', ?, ?, ?, 'pending', ?, ?, ?, ?, 0, null, null, ?)`,
      input.mutationId,
      input.recordId,
      operation,
      JSON.stringify(payload),
      input.now,
      baseRevision,
      input.idempotencyKey,
      JSON.stringify(input.localDependencyIds),
      input.now,
    );
    await database.runAsync(
      `insert into local_records (
        record_id, child_id, category, source_type, confirmation_state,
        event_at, access_scope, revision, version, version_id,
        payload_json, server_payload_json, updated_at, deleted_at, sync_status
      ) values (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, null, ?, null, 'pending')
      on conflict(record_id) do update set
        child_id = excluded.child_id,
        category = excluded.category,
        source_type = excluded.source_type,
        confirmation_state = excluded.confirmation_state,
        event_at = excluded.event_at,
        access_scope = excluded.access_scope,
        version_id = excluded.version_id,
        version = excluded.version,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at,
        deleted_at = null,
        sync_status = 'pending'`,
      input.recordId,
      input.childId,
      input.category,
      input.sourceType,
      input.eventAt,
      input.category === "identity" ? "identityDocuments" : "selectedHealthRecords",
      baseRevision ?? 1,
      (baseRevision ?? 0) + 1,
      input.mutationId,
      JSON.stringify(input.content),
      input.now,
    );
    await database.runAsync(
      "delete from local_timeline_entries where record_id = ?",
      input.recordId,
    );
    await database.runAsync(
      `insert into local_timeline_entries (
        entry_id, child_id, record_id, source_version_id, event_at,
        payload_json, revision, updated_at, deleted_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, null)`,
      input.mutationId,
      input.childId,
      input.recordId,
      input.mutationId,
      input.eventAt ?? input.now,
      JSON.stringify({
        category: input.category,
        dateAuthority: input.eventAt ? "recordEventAt" : "confirmedAtFallback",
        title: input.content.title,
      } satisfies GeneratedRecordTimelineContent),
      baseRevision ?? 1,
      input.now,
    );
    if (input.draftId) {
      await database.runAsync("delete from local_record_drafts where draft_id = ?", input.draftId);
    }
  });
}

export async function queueRecordDelete(
  database: LocalSyncDatabase,
  input: {
    readonly idempotencyKey: string;
    readonly mutationId: string;
    readonly now: string;
    readonly recordId: string;
  },
): Promise<void> {
  await database.withTransactionAsync(async () => {
    const current = await database.getFirstAsync<{ readonly revision: number }>(
      "select revision from local_records where record_id = ? and deleted_at is null",
      input.recordId,
    );
    if (!current) {
      throw new Error("The record is unavailable in the local repository.");
    }
    await database.runAsync(
      `insert into local_mutations (
        mutation_id, entity_type, entity_id, operation, payload_json, status,
        created_at, base_revision, idempotency_key, dependency_ids_json,
        attempts, next_attempt_at, last_error_code, updated_at
      ) values (?, 'record', ?, 'delete', null, 'pending', ?, ?, ?, '[]', 0, null, null, ?)`,
      input.mutationId,
      input.recordId,
      input.now,
      current.revision,
      input.idempotencyKey,
      input.now,
    );
    await database.runAsync(
      "update local_records set sync_status = 'pending', deleted_at = ? where record_id = ?",
      input.now,
      input.recordId,
    );
    await database.runAsync(
      "update local_timeline_entries set deleted_at = ? where record_id = ?",
      input.now,
      input.recordId,
    );
  });
}

export async function queueChildProfileUpdate(
  database: LocalSyncDatabase,
  input: {
    readonly childId: string;
    readonly idempotencyKey: string;
    readonly localDependencyIds: ReadonlyArray<string>;
    readonly mutationId: string;
    readonly now: string;
    readonly payload: {
      readonly dateOfBirth: string;
      readonly preferredName: string;
    };
  },
): Promise<void> {
  await database.withTransactionAsync(async () => {
    const child = await database.getFirstAsync<{ readonly revision: number }>(
      "select revision from local_children where child_id = ? and deleted_at is null",
      input.childId,
    );
    if (!child) {
      throw new Error("The child profile is unavailable in the local repository.");
    }
    await database.runAsync(
      `insert into local_mutations (
        mutation_id, entity_type, entity_id, operation, payload_json, status,
        created_at, base_revision, idempotency_key, dependency_ids_json,
        attempts, next_attempt_at, last_error_code, updated_at
      ) values (?, 'child', ?, 'update', ?, 'pending', ?, ?, ?, ?, 0, null, null, ?)`,
      input.mutationId,
      input.childId,
      JSON.stringify(input.payload),
      input.now,
      child.revision,
      input.idempotencyKey,
      JSON.stringify(input.localDependencyIds),
      input.now,
    );
    await database.runAsync(
      `update local_children
       set payload_json = ?, sync_status = 'pending', updated_at = ?
       where child_id = ?`,
      JSON.stringify(input.payload),
      input.now,
      input.childId,
    );
  });
}

export async function queueEmergencyCardUpdate(
  database: LocalSyncDatabase,
  input: {
    readonly cardId: string;
    readonly childId: string;
    readonly content: EmergencyCardContent;
    readonly idempotencyKey: string;
    readonly localDependencyIds: ReadonlyArray<string>;
    readonly mutationId: string;
    readonly now: string;
  },
): Promise<void> {
  await database.withTransactionAsync(async () => {
    const card = await database.getFirstAsync<{ readonly revision: number }>(
      "select revision from local_emergency_cards where card_id = ? and deleted_at is null",
      input.cardId,
    );
    const baseRevision = card?.revision ?? null;
    const operation = card ? "update" : "create";
    const payload = {
      accessMode: "standard" as const,
      childId: input.childId,
      content: input.content,
    };
    await database.runAsync(
      `insert into local_mutations (
        mutation_id, entity_type, entity_id, operation, payload_json, status,
        created_at, base_revision, idempotency_key, dependency_ids_json,
        attempts, next_attempt_at, last_error_code, updated_at
      ) values (?, 'emergencyCard', ?, ?, ?, 'pending', ?, ?, ?, ?, 0, null, null, ?)`,
      input.mutationId,
      input.cardId,
      operation,
      JSON.stringify(payload),
      input.now,
      baseRevision,
      input.idempotencyKey,
      JSON.stringify(input.localDependencyIds),
      input.now,
    );
    await database.runAsync(
      `insert into local_emergency_cards (
        child_id, revision, payload_json, updated_at, card_id, child_id_snapshot,
        version, access_mode, server_payload_json, sync_status, deleted_at
      ) values (?, ?, ?, ?, ?, ?, ?, 'standard', null, 'pending', null)
      on conflict(child_id) do update set
        card_id = excluded.card_id,
        child_id_snapshot = excluded.child_id_snapshot,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at,
        sync_status = 'pending',
        deleted_at = null`,
      input.childId,
      baseRevision ?? 1,
      JSON.stringify(input.content),
      input.now,
      input.cardId,
      input.childId,
      baseRevision ?? 1,
    );
  });
}

export async function listReadyMutations(
  database: LocalSyncDatabase,
  input: { readonly limit: number; readonly now: string },
): Promise<ReadonlyArray<QueuedMutation>> {
  const rows = await database.getAllAsync<LocalMutationRow>(
    `select
      mutation_id as "mutationId",
      entity_id as "entityId",
      entity_type as "entityType",
      operation,
      payload_json as "payloadJson",
      status,
      base_revision as "baseRevision",
      idempotency_key as "idempotencyKey",
      dependency_ids_json as "dependencyIdsJson",
      attempts,
      next_attempt_at as "nextAttemptAt"
    from local_mutations
    order by created_at, mutation_id`,
  );
  const statusMap = new Map(
    rows.map((row) => [parseMutationId(row.mutationId), parseMutationStatus(row.status)]),
  );
  return rows
    .filter(
      (row) =>
        (row.status === "pending" || row.status === "retrying") &&
        (!row.nextAttemptAt || Date.parse(row.nextAttemptAt) <= Date.parse(input.now)),
    )
    .map(queuedMutation)
    .filter(
      (mutation) =>
        dependencyReadiness(
          mutation.localDependencyIds.map((id) => parseMutationId(id)),
          statusMap,
        ) === "ready",
    )
    .slice(0, input.limit);
}

export async function markMutationsPushing(
  database: LocalSyncDatabase,
  mutationIds: ReadonlyArray<string>,
  now: string,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    for (const mutationId of mutationIds) {
      await database.runAsync(
        `update local_mutations
         set status = 'pushing', attempts = attempts + 1, updated_at = ?
         where mutation_id = ? and status in ('pending', 'retrying')`,
        now,
        mutationId,
      );
    }
  });
}

export async function markMutationsRetrying(
  database: LocalSyncDatabase,
  input: {
    readonly errorCode: string;
    readonly mutationIds: ReadonlyArray<string>;
    readonly nextAttemptAt: string;
    readonly now: string;
  },
): Promise<void> {
  await database.withTransactionAsync(async () => {
    for (const mutationId of input.mutationIds) {
      await database.runAsync(
        `update local_mutations
         set status = 'retrying', next_attempt_at = ?, last_error_code = ?, updated_at = ?
         where mutation_id = ? and status = 'pushing'`,
        input.nextAttemptAt,
        input.errorCode,
        input.now,
        mutationId,
      );
    }
  });
}

export async function pauseMutationsForAuthentication(
  database: LocalSyncDatabase,
  mutationIds: ReadonlyArray<string>,
  now: string,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    for (const mutationId of mutationIds) {
      await database.runAsync(
        `update local_mutations
         set status = 'pending', last_error_code = 'authenticationRequired', updated_at = ?
         where mutation_id = ? and status = 'pushing'`,
        now,
        mutationId,
      );
    }
  });
}

export async function applyMutationResults(
  database: LocalSyncDatabase,
  results: ReadonlyArray<MutationResult>,
  now: string,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    for (const result of results) {
      const mutation = await database.getFirstAsync<LocalMutationRow>(
        `select
          mutation_id as "mutationId", entity_id as "entityId",
          entity_type as "entityType", operation,
          payload_json as "payloadJson", status, base_revision as "baseRevision",
          idempotency_key as "idempotencyKey",
          dependency_ids_json as "dependencyIdsJson", attempts,
          next_attempt_at as "nextAttemptAt"
         from local_mutations where mutation_id = ?`,
        result.mutationId,
      );
      if ("entity" in result) {
        if ("recordId" in result.entity) {
          if (mutation?.operation === "delete") {
            await database.runAsync(
              "delete from local_timeline_entries where record_id = ?",
              result.entityId,
            );
            await database.runAsync(
              "delete from local_records where record_id = ?",
              result.entityId,
            );
          } else {
            await upsertSyncedRecord(database, result.entity);
          }
        } else if ("cardId" in result.entity) {
          await upsertSyncedEmergencyCard(database, result.entity);
        } else {
          await upsertSyncedChild(database, result.entity);
        }
        await database.runAsync(
          `update local_mutations
           set status = ?, next_attempt_at = null, last_error_code = null, updated_at = ?
           where mutation_id = ?`,
          result.status,
          now,
          result.mutationId,
        );
        continue;
      }
      if (result.status === "conflict") {
        await database.runAsync(
          `update local_mutations set status = 'conflict', last_error_code = ?, updated_at = ?
           where mutation_id = ?`,
          result.reason,
          now,
          result.mutationId,
        );
        let conflictType: "child" | "emergencyCard" | "record";
        let serverPayload: string;
        if ("recordId" in result.current) {
          conflictType = "record";
          serverPayload = recordContentPayload(result.current.content);
        } else if ("cardId" in result.current) {
          conflictType = "emergencyCard";
          serverPayload = emergencyContentPayload(result.current.content);
        } else {
          conflictType = "child";
          serverPayload = profilePayload(result.current);
        }
        if (conflictType === "record" && "recordId" in result.current) {
          await database.runAsync(
            `update local_records
             set revision = ?, version = ?, version_id = ?,
                 server_payload_json = ?, sync_status = 'conflict'
             where record_id = ?`,
            result.current.revision,
            result.current.version,
            result.current.versionId,
            serverPayload,
            result.entityId,
          );
        } else if (conflictType === "emergencyCard" && "cardId" in result.current) {
          await database.runAsync(
            `update local_emergency_cards
             set revision = ?, version = ?, server_payload_json = ?, sync_status = 'conflict'
             where card_id = ?`,
            result.current.revision,
            result.current.version,
            serverPayload,
            result.entityId,
          );
        } else {
          await database.runAsync(
            `update local_children
             set revision = ?, server_payload_json = ?, sync_status = 'conflict'
             where child_id = ?`,
            result.current.revision,
            serverPayload,
            result.entityId,
          );
        }
        await database.runAsync(
          `insert or replace into local_conflicts (
            conflict_id, mutation_id, entity_type, entity_id,
            local_payload_json, server_payload_json, reason, created_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
          result.mutationId,
          result.mutationId,
          conflictType,
          result.entityId,
          mutation?.payloadJson ?? null,
          serverPayload,
          result.reason,
          now,
        );
        continue;
      }
      await database.runAsync(
        `update local_mutations set status = 'rejected', last_error_code = ?, updated_at = ?
         where mutation_id = ?`,
        result.reason,
        now,
        result.mutationId,
      );
      await database.runAsync(
        mutation?.entityType === "record"
          ? "update local_records set sync_status = 'rejected' where record_id = ?"
          : mutation?.entityType === "emergencyCard"
            ? "update local_emergency_cards set sync_status = 'rejected' where card_id = ?"
            : "update local_children set sync_status = 'rejected' where child_id = ?",
        result.entityId,
      );
    }
  });
}

export async function applyChangePage(
  database: LocalSyncDatabase,
  input: {
    readonly changes: ReadonlyArray<RemoteChange>;
    readonly householdId: string;
    readonly nextCursor: string;
    readonly now: string;
  },
): Promise<void> {
  await database.withTransactionAsync(async () => {
    for (const change of input.changes) {
      const entityType = change.entityType ?? "child";
      const pending = await pendingMutationForEntity(database, entityType, change.entityId);
      if (change.operation === "upsert") {
        if (entityType === "record" && "versionId" in change.entity) {
          if (pending) {
            await database.runAsync(
              `update local_records
               set revision = ?, version = ?, version_id = ?,
                   server_payload_json = ?, deleted_at = null
               where record_id = ?`,
              change.entity.revision,
              change.entity.version,
              change.entity.versionId,
              recordContentPayload(change.entity.content),
              change.entityId,
            );
          } else {
            await upsertSyncedRecord(database, change.entity);
          }
        } else if (entityType === "timelineEntry" && "entryId" in change.entity) {
          if (!pending) {
            await upsertSyncedTimeline(database, change.entity);
          }
        } else if (entityType === "emergencyCard" && "cardId" in change.entity) {
          if (pending) {
            await database.runAsync(
              `update local_emergency_cards
               set revision = ?, version = ?, server_payload_json = ?, deleted_at = null
               where card_id = ?`,
              change.entity.revision,
              change.entity.version,
              emergencyContentPayload(change.entity.content),
              change.entityId,
            );
          } else {
            await upsertSyncedEmergencyCard(database, change.entity);
          }
        } else if (
          pending &&
          !("cardId" in change.entity) &&
          !("recordId" in change.entity) &&
          !("entryId" in change.entity)
        ) {
          await database.runAsync(
            `update local_children
             set revision = ?, server_payload_json = ?, deleted_at = null
             where child_id = ?`,
            change.entity.revision,
            profilePayload(change.entity),
            change.entityId,
          );
        } else if (
          !("cardId" in change.entity) &&
          !("recordId" in change.entity) &&
          !("entryId" in change.entity)
        ) {
          await upsertSyncedChild(database, change.entity);
        }
        await database.runAsync(
          "delete from local_tombstones where entity_type = ? and entity_id = ?",
          entityType,
          change.entityId,
        );
        continue;
      }
      await database.runAsync(
        `insert or replace into local_tombstones (entity_type, entity_id, deleted_at)
         values (?, ?, ?)`,
        entityType,
        change.entityId,
        change.changedAt,
      );
      if (entityType === "timelineEntry" && pending) {
        continue;
      }
      if (!pending) {
        if (entityType === "record") {
          await database.runAsync(
            "delete from local_timeline_entries where record_id = ?",
            change.entityId,
          );
          await database.runAsync("delete from local_records where record_id = ?", change.entityId);
        } else {
          await database.runAsync(
            entityType === "timelineEntry"
              ? "delete from local_timeline_entries where entry_id = ?"
              : entityType === "emergencyCard"
                ? "delete from local_emergency_cards where card_id = ?"
                : "delete from local_children where child_id = ?",
            change.entityId,
          );
        }
        continue;
      }
      await database.runAsync(
        `update local_mutations
         set status = 'conflict', last_error_code = 'tombstoneWins', updated_at = ?
         where mutation_id = ?`,
        input.now,
        pending.mutationId,
      );
      await database.runAsync(
        entityType === "record"
          ? `update local_records set sync_status = 'conflict', deleted_at = ? where record_id = ?`
          : entityType === "emergencyCard"
            ? `update local_emergency_cards set sync_status = 'conflict', deleted_at = ? where card_id = ?`
            : `update local_children set sync_status = 'conflict', deleted_at = ? where child_id = ?`,
        change.changedAt,
        change.entityId,
      );
      await database.runAsync(
        `insert or replace into local_conflicts (
          conflict_id, mutation_id, entity_type, entity_id,
          local_payload_json, server_payload_json, reason, created_at
        ) values (?, ?, ?, ?, ?, null, 'tombstoneWins', ?)`,
        pending.mutationId,
        pending.mutationId,
        entityType,
        change.entityId,
        pending.payloadJson,
        input.now,
      );
    }
    await upsertSyncState(database, input.householdId, input.nextCursor, input.now, "idle");
  });
}

export async function beginSnapshot(
  database: LocalSyncDatabase,
  householdId: string,
  capturedCursor: string,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.runAsync("delete from local_snapshot_children");
    await database.runAsync("delete from local_snapshot_emergency_cards");
    await database.runAsync("delete from local_snapshot_records");
    await database.runAsync("delete from local_snapshot_timeline_entries");
    await database.runAsync(
      `insert into local_sync_state (
        household_id, opaque_cursor, last_completed_at, reset_status, captured_cursor
      ) values (?, null, null, 'staging', ?)
      on conflict(household_id) do update set
        reset_status = 'staging', captured_cursor = excluded.captured_cursor`,
      householdId,
      capturedCursor,
    );
  });
}

export async function stageSnapshotPage(
  database: LocalSyncDatabase,
  items: ReadonlyArray<ChildProfile | EmergencyCard | RecordProjection | TimelineProjection>,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    for (const item of items) {
      if ("recordId" in item && "entryId" in item) {
        await database.runAsync(
          `insert or replace into local_snapshot_timeline_entries (entry_id, payload_json)
           values (?, ?)`,
          item.entryId,
          JSON.stringify(item),
        );
        continue;
      }
      if ("recordId" in item) {
        await database.runAsync(
          `insert or replace into local_snapshot_records (record_id, payload_json)
           values (?, ?)`,
          item.recordId,
          JSON.stringify(item),
        );
        continue;
      }
      if ("cardId" in item) {
        await database.runAsync(
          `insert or replace into local_snapshot_emergency_cards (
            card_id, child_id, revision, version, access_mode, payload_json, updated_at
          ) values (?, ?, ?, ?, 'standard', ?, ?)`,
          item.cardId,
          item.childId,
          item.revision,
          item.version,
          emergencyContentPayload(item.content),
          item.updatedAt,
        );
        continue;
      }
      await database.runAsync(
        `insert or replace into local_snapshot_children (
          child_id, revision, payload_json, updated_at
        ) values (?, ?, ?, ?)`,
        item.childId,
        item.revision,
        profilePayload(item),
        item.updatedAt,
      );
    }
  });
}

export async function finalizeSnapshot(
  database: LocalSyncDatabase,
  input: { readonly capturedCursor: string; readonly householdId: string; readonly now: string },
): Promise<void> {
  await database.withTransactionAsync(async () => {
    const staged = await database.getAllAsync<{
      readonly childId: string;
      readonly payloadJson: string;
      readonly revision: number;
      readonly updatedAt: string;
    }>(
      `select child_id as "childId", revision, payload_json as "payloadJson",
        updated_at as "updatedAt" from local_snapshot_children order by child_id`,
    );
    const pending = await database.getAllAsync<{
      readonly entityId: string;
      readonly mutationId: string;
      readonly payloadJson: string;
    }>(
      `select entity_id as "entityId", mutation_id as "mutationId",
        payload_json as "payloadJson"
       from local_mutations
       where entity_type = 'child'
         and status in ('pending', 'pushing', 'retrying', 'conflict', 'rejected')`,
    );
    const pendingByEntity = new Map(pending.map((row) => [row.entityId, row]));
    const stagedIds = new Set(staged.map((row) => row.childId));
    const existing = await database.getAllAsync<{ readonly childId: string }>(
      `select child_id as "childId" from local_children`,
    );
    for (const child of existing) {
      if (!stagedIds.has(child.childId) && !pendingByEntity.has(child.childId)) {
        await database.runAsync("delete from local_children where child_id = ?", child.childId);
      }
    }
    for (const item of staged) {
      const localPending = pendingByEntity.get(item.childId);
      if (localPending) {
        await database.runAsync(
          `update local_children
           set revision = ?, server_payload_json = ?, deleted_at = null
           where child_id = ?`,
          item.revision,
          item.payloadJson,
          item.childId,
        );
      } else {
        await upsertSyncedChild(database, {
          childId: item.childId,
          ...parseProfilePayload(item.payloadJson),
          revision: item.revision,
          updatedAt: item.updatedAt,
        });
      }
      await database.runAsync(
        "delete from local_tombstones where entity_type = 'child' and entity_id = ?",
        item.childId,
      );
    }
    for (const [entityId, localPending] of pendingByEntity) {
      if (stagedIds.has(entityId)) {
        continue;
      }
      await database.runAsync(
        `update local_mutations
         set status = 'conflict', last_error_code = 'snapshotMissing', updated_at = ?
         where mutation_id = ?`,
        input.now,
        localPending.mutationId,
      );
      await database.runAsync(
        "update local_children set sync_status = 'conflict' where child_id = ?",
        entityId,
      );
      await database.runAsync(
        `insert or replace into local_conflicts (
          conflict_id, mutation_id, entity_type, entity_id,
          local_payload_json, server_payload_json, reason, created_at
        ) values (?, ?, 'child', ?, ?, null, 'snapshotMissing', ?)`,
        localPending.mutationId,
        localPending.mutationId,
        entityId,
        localPending.payloadJson,
        input.now,
      );
    }
    const stagedCards = await database.getAllAsync<{
      readonly accessMode: "standard";
      readonly cardId: string;
      readonly childId: string;
      readonly payloadJson: string;
      readonly revision: number;
      readonly updatedAt: string;
      readonly version: number;
    }>(
      `select card_id as "cardId", child_id as "childId", revision, version,
        access_mode as "accessMode", payload_json as "payloadJson",
        updated_at as "updatedAt"
       from local_snapshot_emergency_cards order by card_id`,
    );
    const pendingCards = await database.getAllAsync<{
      readonly entityId: string;
      readonly mutationId: string;
      readonly payloadJson: string;
    }>(
      `select entity_id as "entityId", mutation_id as "mutationId",
        payload_json as "payloadJson"
       from local_mutations
       where entity_type = 'emergencyCard'
         and status in ('pending', 'pushing', 'retrying', 'conflict', 'rejected')`,
    );
    const pendingCardsByEntity = new Map(pendingCards.map((row) => [row.entityId, row]));
    const stagedCardIds = new Set(stagedCards.map((row) => row.cardId));
    const existingCards = await database.getAllAsync<{ readonly cardId: string }>(
      `select card_id as "cardId" from local_emergency_cards where card_id is not null`,
    );
    for (const card of existingCards) {
      if (!stagedCardIds.has(card.cardId) && !pendingCardsByEntity.has(card.cardId)) {
        await database.runAsync("delete from local_emergency_cards where card_id = ?", card.cardId);
      }
    }
    for (const item of stagedCards) {
      const localPending = pendingCardsByEntity.get(item.cardId);
      if (localPending) {
        await database.runAsync(
          `update local_emergency_cards
           set revision = ?, version = ?, server_payload_json = ?, deleted_at = null
           where card_id = ?`,
          item.revision,
          item.version,
          item.payloadJson,
          item.cardId,
        );
      } else {
        await upsertSyncedEmergencyCard(database, {
          accessMode: item.accessMode,
          cardId: item.cardId,
          childId: item.childId,
          content: parseEmergencyContent(item.payloadJson),
          revision: item.revision,
          updatedAt: item.updatedAt,
          version: item.version,
        });
      }
      await database.runAsync(
        "delete from local_tombstones where entity_type = 'emergencyCard' and entity_id = ?",
        item.cardId,
      );
    }
    for (const [entityId, localPending] of pendingCardsByEntity) {
      if (stagedCardIds.has(entityId)) {
        continue;
      }
      await database.runAsync(
        `update local_mutations
         set status = 'conflict', last_error_code = 'snapshotMissing', updated_at = ?
         where mutation_id = ?`,
        input.now,
        localPending.mutationId,
      );
      await database.runAsync(
        "update local_emergency_cards set sync_status = 'conflict' where card_id = ?",
        entityId,
      );
      await database.runAsync(
        `insert or replace into local_conflicts (
          conflict_id, mutation_id, entity_type, entity_id,
          local_payload_json, server_payload_json, reason, created_at
        ) values (?, ?, 'emergencyCard', ?, ?, null, 'snapshotMissing', ?)`,
        localPending.mutationId,
        localPending.mutationId,
        entityId,
        localPending.payloadJson,
        input.now,
      );
    }
    await finalizeRecordSnapshot(database, input.now);
    await database.runAsync("delete from local_snapshot_children");
    await database.runAsync("delete from local_snapshot_emergency_cards");
    await database.runAsync("delete from local_snapshot_records");
    await database.runAsync("delete from local_snapshot_timeline_entries");
    await upsertSyncState(database, input.householdId, input.capturedCursor, input.now, "idle");
  });
}

export async function readSyncCursor(
  database: LocalSyncDatabase,
  householdId: string,
): Promise<string | null> {
  const row = await database.getFirstAsync<{ readonly cursor: string | null }>(
    `select opaque_cursor as cursor from local_sync_state where household_id = ?`,
    householdId,
  );
  return row?.cursor ?? null;
}

export async function countRiskyMutations(database: LocalSyncDatabase): Promise<number> {
  const row = await database.getFirstAsync<{ readonly count: number }>(
    `select count(*) as count from local_mutations
     where status in ('pending', 'pushing', 'retrying', 'conflict', 'rejected')`,
  );
  return row?.count ?? 0;
}

async function finalizeRecordSnapshot(database: LocalSyncDatabase, now: string): Promise<void> {
  const stagedRows = await database.getAllAsync<{
    readonly payloadJson: string;
    readonly recordId: string;
  }>(
    `select record_id as "recordId", payload_json as "payloadJson"
     from local_snapshot_records order by record_id`,
  );
  const staged = stagedRows.map((row) => parseRecordProjection(row.payloadJson));
  const pending = await database.getAllAsync<{
    readonly entityId: string;
    readonly mutationId: string;
    readonly payloadJson: string | null;
  }>(
    `select entity_id as "entityId", mutation_id as "mutationId",
      payload_json as "payloadJson"
     from local_mutations
     where entity_type = 'record'
       and status in ('pending', 'pushing', 'retrying', 'conflict', 'rejected')`,
  );
  const pendingByEntity = new Map(pending.map((row) => [row.entityId, row]));
  const stagedIds = new Set(staged.map((record) => record.recordId));
  const existing = await database.getAllAsync<{ readonly recordId: string }>(
    `select record_id as "recordId" from local_records`,
  );
  for (const record of existing) {
    if (!stagedIds.has(record.recordId) && !pendingByEntity.has(record.recordId)) {
      await database.runAsync(
        "delete from local_timeline_entries where record_id = ?",
        record.recordId,
      );
      await database.runAsync("delete from local_records where record_id = ?", record.recordId);
    }
  }
  for (const record of staged) {
    const localPending = pendingByEntity.get(record.recordId);
    if (localPending) {
      await database.runAsync(
        `update local_records
         set revision = ?, version = ?, version_id = ?,
             server_payload_json = ?
         where record_id = ?`,
        record.revision,
        record.version,
        record.versionId,
        recordContentPayload(record.content),
        record.recordId,
      );
    } else {
      await upsertSyncedRecord(database, record);
    }
    await database.runAsync(
      "delete from local_tombstones where entity_type = 'record' and entity_id = ?",
      record.recordId,
    );
  }
  for (const [recordId, localPending] of pendingByEntity) {
    if (stagedIds.has(recordId)) {
      continue;
    }
    await database.runAsync(
      `update local_mutations
       set status = 'conflict', last_error_code = 'snapshotMissing', updated_at = ?
       where mutation_id = ?`,
      now,
      localPending.mutationId,
    );
    await database.runAsync(
      "update local_records set sync_status = 'conflict' where record_id = ?",
      recordId,
    );
    await database.runAsync(
      `insert or replace into local_conflicts (
        conflict_id, mutation_id, entity_type, entity_id,
        local_payload_json, server_payload_json, reason, created_at
      ) values (?, ?, 'record', ?, ?, null, 'snapshotMissing', ?)`,
      localPending.mutationId,
      localPending.mutationId,
      recordId,
      localPending.payloadJson,
      now,
    );
  }

  const stagedTimelineRows = await database.getAllAsync<{
    readonly entryId: string;
    readonly payloadJson: string;
  }>(
    `select entry_id as "entryId", payload_json as "payloadJson"
     from local_snapshot_timeline_entries order by entry_id`,
  );
  const stagedTimeline = stagedTimelineRows.map((row) => parseTimelineProjection(row.payloadJson));
  const stagedTimelineIds = new Set(stagedTimeline.map((entry) => entry.entryId));
  const existingTimeline = await database.getAllAsync<{
    readonly entryId: string;
    readonly recordId: string;
  }>(
    `select entry_id as "entryId", record_id as "recordId"
     from local_timeline_entries`,
  );
  for (const entry of existingTimeline) {
    if (!stagedTimelineIds.has(entry.entryId) && !pendingByEntity.has(entry.recordId)) {
      await database.runAsync(
        "delete from local_timeline_entries where entry_id = ?",
        entry.entryId,
      );
    }
  }
  for (const entry of stagedTimeline) {
    if (!pendingByEntity.has(entry.recordId)) {
      await upsertSyncedTimeline(database, entry);
    }
    await database.runAsync(
      "delete from local_tombstones where entity_type = 'timelineEntry' and entity_id = ?",
      entry.entryId,
    );
  }
}

async function pendingMutationForEntity(
  database: LocalSyncDatabase,
  entityType: "child" | "emergencyCard" | "record" | "timelineEntry",
  entityId: string,
): Promise<{ readonly mutationId: string; readonly payloadJson: string | null } | null> {
  if (entityType === "timelineEntry") {
    return database.getFirstAsync(
      `select mutation_id as "mutationId", payload_json as "payloadJson"
       from local_mutations
       where entity_type = 'record'
         and entity_id = (
           select record_id from local_timeline_entries where entry_id = ?
         )
         and status in ('pending', 'pushing', 'retrying', 'conflict', 'rejected')
       order by created_at desc limit 1`,
      entityId,
    );
  }
  return database.getFirstAsync(
    `select mutation_id as "mutationId", payload_json as "payloadJson"
     from local_mutations
     where entity_type = ? and entity_id = ?
       and status in ('pending', 'pushing', 'retrying', 'conflict', 'rejected')
     order by created_at desc limit 1`,
    entityType,
    entityId,
  );
}

async function upsertSyncedChild(database: LocalSyncDatabase, child: ChildProfile): Promise<void> {
  const payload = profilePayload(child);
  await database.runAsync(
    `insert into local_children (
      child_id, revision, payload_json, updated_at, deleted_at,
      server_payload_json, sync_status
    ) values (?, ?, ?, ?, null, ?, 'synced')
    on conflict(child_id) do update set
      revision = excluded.revision,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at,
      deleted_at = null,
      server_payload_json = excluded.server_payload_json,
      sync_status = 'synced'`,
    child.childId,
    child.revision,
    payload,
    child.updatedAt,
    payload,
  );
}

async function upsertSyncedEmergencyCard(
  database: LocalSyncDatabase,
  card: EmergencyCard,
): Promise<void> {
  const payload = emergencyContentPayload(card.content);
  await database.runAsync(
    `insert into local_emergency_cards (
      child_id, revision, payload_json, updated_at, card_id, child_id_snapshot,
      version, access_mode, server_payload_json, sync_status, deleted_at
    ) values (?, ?, ?, ?, ?, ?, ?, 'standard', ?, 'synced', null)
    on conflict(child_id) do update set
      card_id = excluded.card_id,
      child_id_snapshot = excluded.child_id_snapshot,
      revision = excluded.revision,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at,
      version = excluded.version,
      access_mode = excluded.access_mode,
      server_payload_json = excluded.server_payload_json,
      sync_status = 'synced',
      deleted_at = null`,
    card.childId,
    card.revision,
    payload,
    card.updatedAt,
    card.cardId,
    card.childId,
    card.version,
    payload,
  );
}

async function upsertSyncedRecord(
  database: LocalSyncDatabase,
  record: RecordProjection,
): Promise<void> {
  const payload = recordContentPayload(record.content);
  await database.runAsync(
    `insert into local_records (
      record_id, child_id, category, source_type, confirmation_state,
      event_at, access_scope, revision, version, version_id,
      payload_json, server_payload_json, updated_at, deleted_at, sync_status
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, 'synced')
    on conflict(record_id) do update set
      child_id = excluded.child_id,
      category = excluded.category,
      source_type = excluded.source_type,
      confirmation_state = excluded.confirmation_state,
      event_at = excluded.event_at,
      access_scope = excluded.access_scope,
      revision = excluded.revision,
      version = excluded.version,
      version_id = excluded.version_id,
      payload_json = excluded.payload_json,
      server_payload_json = excluded.server_payload_json,
      updated_at = excluded.updated_at,
      deleted_at = null,
      sync_status = 'synced'`,
    record.recordId,
    record.childId,
    record.category,
    record.provenance.sourceType,
    record.confirmationState,
    record.eventAt,
    record.accessScope,
    record.revision,
    record.version,
    record.versionId,
    payload,
    payload,
    record.updatedAt,
  );
  await database.runAsync(
    `insert or ignore into local_record_versions (
      version_id, record_id, version, payload_json, provenance_json,
      confirmed_at, created_at, supersedes_version_id
    ) values (?, ?, ?, ?, ?, ?, ?, null)`,
    record.versionId,
    record.recordId,
    record.version,
    payload,
    JSON.stringify({
      confirmationState: record.confirmationState,
      ...record.provenance,
    }),
    record.confirmationState === "confirmed" ? record.updatedAt : null,
    record.updatedAt,
  );
}

async function upsertSyncedTimeline(
  database: LocalSyncDatabase,
  entry: TimelineProjection,
): Promise<void> {
  await database.runAsync(
    `insert into local_timeline_entries (
      entry_id, child_id, record_id, source_version_id, event_at,
      payload_json, revision, updated_at, deleted_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, null)
    on conflict(entry_id) do update set
      child_id = excluded.child_id,
      record_id = excluded.record_id,
      source_version_id = excluded.source_version_id,
      event_at = excluded.event_at,
      payload_json = excluded.payload_json,
      revision = excluded.revision,
      updated_at = excluded.updated_at,
      deleted_at = null`,
    entry.entryId,
    entry.childId,
    entry.recordId,
    entry.sourceVersionId,
    entry.eventAt,
    JSON.stringify(entry.content),
    entry.revision,
    entry.updatedAt,
  );
}

async function upsertSyncState(
  database: LocalSyncDatabase,
  householdId: string,
  cursor: string,
  now: string,
  resetStatus: "idle" | "staging",
): Promise<void> {
  await database.runAsync(
    `insert into local_sync_state (
      household_id, opaque_cursor, last_completed_at, reset_status, captured_cursor
    ) values (?, ?, ?, ?, null)
    on conflict(household_id) do update set
      opaque_cursor = excluded.opaque_cursor,
      last_completed_at = excluded.last_completed_at,
      reset_status = excluded.reset_status,
      captured_cursor = null`,
    householdId,
    cursor,
    now,
    resetStatus,
  );
}

type LocalChildRow = {
  readonly childId: string;
  readonly deletedAt: string | null;
  readonly payloadJson: string;
  readonly revision: number;
  readonly syncStatus: LocalChildProfile["syncStatus"];
  readonly updatedAt: string;
};

type LocalMutationRow = {
  readonly attempts: number;
  readonly baseRevision: number | null;
  readonly dependencyIdsJson: string;
  readonly entityId: string;
  readonly entityType?: string;
  readonly idempotencyKey: string | null;
  readonly mutationId: string;
  readonly nextAttemptAt: string | null;
  readonly operation?: string;
  readonly payloadJson: string | null;
  readonly status: string;
};

type LocalEmergencyCardRow = {
  readonly accessMode: "standard";
  readonly cardId: string;
  readonly childId: string;
  readonly deletedAt: string | null;
  readonly payloadJson: string;
  readonly revision: number;
  readonly syncStatus: LocalEmergencyCard["syncStatus"];
  readonly updatedAt: string;
  readonly version: number;
};

type LocalRecordRow = {
  readonly accessScope: RecordAccessScope;
  readonly category: RecordCategory;
  readonly childId: string;
  readonly confirmationState: RecordProjection["confirmationState"];
  readonly deletedAt: string | null;
  readonly eventAt: string | null;
  readonly payloadJson: string;
  readonly recordId: string;
  readonly revision: number;
  readonly sourceType: RecordSourceType;
  readonly syncStatus: LocalRecordProjection["syncStatus"];
  readonly updatedAt: string;
  readonly version: number;
  readonly versionId: string;
};

type LocalTimelineRow = {
  readonly childId: string;
  readonly entryId: string;
  readonly eventAt: string;
  readonly payloadJson: string;
  readonly recordId: string;
  readonly revision: number;
  readonly sourceVersionId: string;
  readonly updatedAt: string;
};

type LocalRecordVersionRow = {
  readonly confirmedAt: string | null;
  readonly createdAt: string;
  readonly payloadJson: string;
  readonly provenanceJson: string;
  readonly recordId: string;
  readonly supersedesVersionId: string | null;
  readonly version: number;
  readonly versionId: string;
};

function localChild(row: LocalChildRow): LocalChildProfile {
  return {
    childId: row.childId,
    ...parseProfilePayload(row.payloadJson),
    deletedAt: row.deletedAt,
    revision: row.revision,
    syncStatus: row.syncStatus,
    updatedAt: row.updatedAt,
  };
}

function localEmergencyCard(row: LocalEmergencyCardRow): LocalEmergencyCard {
  return {
    accessMode: row.accessMode,
    cardId: row.cardId,
    childId: row.childId,
    content: parseEmergencyContent(row.payloadJson),
    deletedAt: row.deletedAt,
    revision: row.revision,
    syncStatus: row.syncStatus,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}

function localRecord(row: LocalRecordRow): LocalRecordProjection {
  return {
    accessScope: row.accessScope,
    category: row.category,
    childId: row.childId,
    confirmationState: row.confirmationState,
    content: parseRecordContent(row.payloadJson),
    deletedAt: row.deletedAt,
    eventAt: row.eventAt,
    provenance: {
      sourceType: row.sourceType,
      trustedIssuer:
        row.sourceType === "provider_issued" || row.sourceType === "government_imported",
    },
    recordId: row.recordId,
    revision: row.revision,
    syncStatus: row.syncStatus,
    updatedAt: row.updatedAt,
    version: row.version,
    versionId: row.versionId,
  };
}

function localTimeline(row: LocalTimelineRow): TimelineProjection {
  return {
    childId: row.childId,
    content: JSON.parse(row.payloadJson) as GeneratedRecordTimelineContent,
    entryId: row.entryId,
    eventAt: row.eventAt,
    recordId: row.recordId,
    revision: row.revision,
    sourceVersionId: row.sourceVersionId,
    updatedAt: row.updatedAt,
  };
}

function localRecordVersion(row: LocalRecordVersionRow): RecordVersionProjection {
  const provenance = JSON.parse(row.provenanceJson) as {
    readonly confirmationState?: RecordProjection["confirmationState"];
    readonly sourceType: RecordSourceType;
    readonly trustedIssuer: boolean;
  };
  return {
    confirmedAt: row.confirmedAt,
    confirmationState: provenance.confirmationState ?? "confirmed",
    content: parseRecordContent(row.payloadJson),
    createdAt: row.createdAt,
    provenance: {
      sourceType: provenance.sourceType,
      trustedIssuer: provenance.trustedIssuer,
    },
    recordId: row.recordId,
    supersedesVersionId: row.supersedesVersionId,
    version: row.version,
    versionId: row.versionId,
  };
}

function queuedMutation(row: LocalMutationRow): QueuedMutation {
  if (!row.idempotencyKey) {
    throw new Error("The local mutation is missing OFF-04 dispatch fields.");
  }
  const common = {
    attempts: row.attempts,
    baseRevision: row.baseRevision,
    entityId: row.entityId,
    idempotencyKey: row.idempotencyKey,
    localDependencyIds: parseStringArray(row.dependencyIdsJson),
    mutationId: row.mutationId,
    nextAttemptAt: row.nextAttemptAt,
    status: parseMutationStatus(row.status),
  };
  if (row.entityType === "emergencyCard") {
    if (!row.payloadJson) {
      throw new Error("The local emergency-card mutation payload is missing.");
    }
    if (row.operation !== "create" && row.operation !== "update") {
      throw new Error("The local emergency-card mutation operation is invalid.");
    }
    const payload = JSON.parse(row.payloadJson) as QueuedEmergencyCardMutation["payload"];
    return {
      ...common,
      entityType: "emergencyCard",
      operation: row.operation,
      payload,
    };
  }
  if (row.entityType === "record") {
    if (row.operation === "create") {
      if (row.baseRevision !== null || !row.payloadJson) {
        throw new Error("The local record create mutation is invalid.");
      }
      return {
        ...common,
        baseRevision: null,
        entityType: "record",
        operation: "create",
        payload: JSON.parse(row.payloadJson) as NonNullable<QueuedRecordMutation["payload"]>,
      };
    }
    if (row.operation === "update") {
      if (row.baseRevision === null || !row.payloadJson) {
        throw new Error("The local record update mutation is invalid.");
      }
      return {
        ...common,
        baseRevision: row.baseRevision,
        entityType: "record",
        operation: "update",
        payload: JSON.parse(row.payloadJson) as NonNullable<QueuedRecordMutation["payload"]>,
      };
    }
    if (row.operation === "delete" && row.baseRevision !== null && row.payloadJson === null) {
      return {
        ...common,
        baseRevision: row.baseRevision,
        entityType: "record",
        operation: "delete",
      };
    }
    throw new Error("The local record mutation is invalid.");
  }
  if (!row.payloadJson) {
    throw new Error("The local child mutation payload is missing.");
  }
  if (
    (row.entityType ?? "child") !== "child" ||
    (row.operation ?? "update") !== "update" ||
    row.baseRevision === null
  ) {
    throw new Error("The local child mutation is invalid.");
  }
  return {
    ...common,
    baseRevision: row.baseRevision,
    entityType: "child",
    operation: "update",
    payload: parseProfilePayload(row.payloadJson),
  };
}

function profilePayload(child: {
  readonly dateOfBirth: string;
  readonly preferredName: string;
}): string {
  return JSON.stringify({
    dateOfBirth: child.dateOfBirth,
    preferredName: child.preferredName,
  });
}

function emergencyContentPayload(content: EmergencyCardContent): string {
  return JSON.stringify(content);
}

function recordContentPayload(content: RecordVersionContentV1): string {
  return JSON.stringify(content);
}

function parseProfilePayload(value: string): {
  readonly dateOfBirth: string;
  readonly preferredName: string;
} {
  const parsed = JSON.parse(value) as {
    readonly dateOfBirth?: unknown;
    readonly preferredName?: unknown;
  };
  if (
    typeof parsed.dateOfBirth !== "string" ||
    typeof parsed.preferredName !== "string" ||
    parsed.preferredName.length < 1
  ) {
    throw new Error("The local child profile payload is invalid.");
  }
  return { dateOfBirth: parsed.dateOfBirth, preferredName: parsed.preferredName };
}

function parseEmergencyContent(value: string): EmergencyCardContent {
  return JSON.parse(value) as EmergencyCardContent;
}

function parseRecordContent(value: string): RecordVersionContentV1 {
  return JSON.parse(value) as RecordVersionContentV1;
}

function parseRecordProjection(value: string): RecordProjection {
  return JSON.parse(value) as RecordProjection;
}

function parseTimelineProjection(value: string): TimelineProjection {
  return JSON.parse(value) as TimelineProjection;
}

function parseStringArray(value: string): ReadonlyArray<string> {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error("The local mutation dependency list is invalid.");
  }
  return parsed;
}

function parseMutationStatus(value: string): LocalMutationStatus {
  if (
    value !== "pending" &&
    value !== "pushing" &&
    value !== "retrying" &&
    value !== "applied" &&
    value !== "duplicate" &&
    value !== "conflict" &&
    value !== "rejected"
  ) {
    throw new Error("The local mutation status is invalid.");
  }
  return value;
}
