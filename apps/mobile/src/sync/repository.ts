import { dependencyReadiness, type LocalMutationStatus, parseMutationId } from "@littlearc/domain";

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

export type QueuedChildMutation = {
  readonly attempts: number;
  readonly baseRevision: number;
  readonly entityId: string;
  readonly idempotencyKey: string;
  readonly localDependencyIds: ReadonlyArray<string>;
  readonly mutationId: string;
  readonly nextAttemptAt: string | null;
  readonly payload: {
    readonly dateOfBirth: string;
    readonly preferredName: string;
  };
  readonly status: LocalMutationStatus;
};

export type RemoteChange =
  | {
      readonly changedAt: string;
      readonly entity: ChildProfile;
      readonly entityId: string;
      readonly operation: "upsert";
      readonly revision: number;
    }
  | {
      readonly changedAt: string;
      readonly entityId: string;
      readonly operation: "delete";
      readonly revision: number;
    };

export type MutationResult =
  | {
      readonly entity: ChildProfile;
      readonly entityId: string;
      readonly mutationId: string;
      readonly status: "applied" | "duplicate";
    }
  | {
      readonly current: ChildProfile;
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

export async function listReadyMutations(
  database: LocalSyncDatabase,
  input: { readonly limit: number; readonly now: string },
): Promise<ReadonlyArray<QueuedChildMutation>> {
  const rows = await database.getAllAsync<LocalMutationRow>(
    `select
      mutation_id as "mutationId",
      entity_id as "entityId",
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
      if ("entity" in result) {
        await upsertSyncedChild(database, result.entity);
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
      const mutation = await database.getFirstAsync<LocalMutationRow>(
        `select
          mutation_id as "mutationId", entity_id as "entityId",
          payload_json as "payloadJson", status, base_revision as "baseRevision",
          idempotency_key as "idempotencyKey",
          dependency_ids_json as "dependencyIdsJson", attempts,
          next_attempt_at as "nextAttemptAt"
         from local_mutations where mutation_id = ?`,
        result.mutationId,
      );
      if (result.status === "conflict") {
        await database.runAsync(
          `update local_mutations set status = 'conflict', last_error_code = ?, updated_at = ?
           where mutation_id = ?`,
          result.reason,
          now,
          result.mutationId,
        );
        await database.runAsync(
          `update local_children
           set revision = ?, server_payload_json = ?, sync_status = 'conflict'
           where child_id = ?`,
          result.current.revision,
          profilePayload(result.current),
          result.entityId,
        );
        await database.runAsync(
          `insert or replace into local_conflicts (
            conflict_id, mutation_id, entity_type, entity_id,
            local_payload_json, server_payload_json, reason, created_at
          ) values (?, ?, 'child', ?, ?, ?, ?, ?)`,
          result.mutationId,
          result.mutationId,
          result.entityId,
          mutation?.payloadJson ?? null,
          profilePayload(result.current),
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
        "update local_children set sync_status = 'rejected' where child_id = ?",
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
      const pending = await pendingMutationForEntity(database, change.entityId);
      if (change.operation === "upsert") {
        if (pending) {
          await database.runAsync(
            `update local_children
             set revision = ?, server_payload_json = ?, deleted_at = null
             where child_id = ?`,
            change.entity.revision,
            profilePayload(change.entity),
            change.entityId,
          );
        } else {
          await upsertSyncedChild(database, change.entity);
        }
        await database.runAsync(
          "delete from local_tombstones where entity_type = 'child' and entity_id = ?",
          change.entityId,
        );
        continue;
      }
      await database.runAsync(
        `insert or replace into local_tombstones (entity_type, entity_id, deleted_at)
         values ('child', ?, ?)`,
        change.entityId,
        change.changedAt,
      );
      if (!pending) {
        await database.runAsync("delete from local_children where child_id = ?", change.entityId);
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
        `update local_children set sync_status = 'conflict', deleted_at = ? where child_id = ?`,
        change.changedAt,
        change.entityId,
      );
      await database.runAsync(
        `insert or replace into local_conflicts (
          conflict_id, mutation_id, entity_type, entity_id,
          local_payload_json, server_payload_json, reason, created_at
        ) values (?, ?, 'child', ?, ?, null, 'tombstoneWins', ?)`,
        pending.mutationId,
        pending.mutationId,
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
  items: ReadonlyArray<ChildProfile>,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    for (const item of items) {
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
    await database.runAsync("delete from local_snapshot_children");
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

async function pendingMutationForEntity(
  database: LocalSyncDatabase,
  entityId: string,
): Promise<{ readonly mutationId: string; readonly payloadJson: string } | null> {
  return database.getFirstAsync(
    `select mutation_id as "mutationId", payload_json as "payloadJson"
     from local_mutations
     where entity_type = 'child' and entity_id = ?
       and status in ('pending', 'pushing', 'retrying', 'conflict', 'rejected')
     order by created_at desc limit 1`,
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
  readonly idempotencyKey: string | null;
  readonly mutationId: string;
  readonly nextAttemptAt: string | null;
  readonly payloadJson: string | null;
  readonly status: string;
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

function queuedMutation(row: LocalMutationRow): QueuedChildMutation {
  if (row.baseRevision === null || !row.idempotencyKey || !row.payloadJson) {
    throw new Error("The local mutation is missing OFF-04 dispatch fields.");
  }
  return {
    attempts: row.attempts,
    baseRevision: row.baseRevision,
    entityId: row.entityId,
    idempotencyKey: row.idempotencyKey,
    localDependencyIds: parseStringArray(row.dependencyIdsJson),
    mutationId: row.mutationId,
    nextAttemptAt: row.nextAttemptAt,
    payload: parseProfilePayload(row.payloadJson),
    status: parseMutationStatus(row.status),
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
