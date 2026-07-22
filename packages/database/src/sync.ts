import { createHash } from "node:crypto";
import type {
  EncryptedEnvelopeV1,
  StructuredPayloadCrypto,
  WrappedHouseholdKey,
} from "@littlearc/crypto";
import {
  assertEmergencyCardContent,
  canEditEmergencyCard,
  canReadEmergencyCard,
  type EmergencyCardContent,
  type HouseholdCapability,
  type HouseholdRole,
  type UuidV7,
} from "@littlearc/domain";
import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./client.js";

export type ChildProfileProjection = {
  readonly childId: UuidV7;
  readonly dateOfBirth: string;
  readonly preferredName: string;
  readonly revision: number;
  readonly updatedAt: string;
};

export type EmergencyCardProjection = {
  readonly accessMode: "standard";
  readonly cardId: UuidV7;
  readonly childId: UuidV7;
  readonly content: EmergencyCardContent;
  readonly revision: number;
  readonly updatedAt: string;
  readonly version: number;
};

export type SyncProjection = ChildProfileProjection | EmergencyCardProjection;

export type SyncPersistenceChange =
  | {
      readonly changedAt: string;
      readonly entity: ChildProfileProjection;
      readonly entityId: UuidV7;
      readonly entityType: "child";
      readonly operation: "upsert";
      readonly revision: number;
      readonly sequence: number;
    }
  | {
      readonly changedAt: string;
      readonly entityId: UuidV7;
      readonly entityType: "child";
      readonly operation: "delete";
      readonly revision: number;
      readonly sequence: number;
    }
  | {
      readonly changedAt: string;
      readonly entity: EmergencyCardProjection;
      readonly entityId: UuidV7;
      readonly entityType: "emergencyCard";
      readonly operation: "upsert";
      readonly revision: number;
      readonly sequence: number;
    }
  | {
      readonly changedAt: string;
      readonly entityId: UuidV7;
      readonly entityType: "emergencyCard";
      readonly operation: "delete";
      readonly revision: number;
      readonly sequence: number;
    };

export type SyncMutationOutcome =
  | {
      readonly entity: SyncProjection;
      readonly entityId: UuidV7;
      readonly mutationId: UuidV7;
      readonly status: "applied" | "duplicate";
    }
  | {
      readonly current: SyncProjection;
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

export type ChildProfileSyncMutation = {
  readonly baseRevision: number;
  readonly entityId: UuidV7;
  readonly idempotencyKey: UuidV7;
  readonly localDependencyIds: ReadonlyArray<UuidV7>;
  readonly mutationId: UuidV7;
  readonly entityType?: "child";
  readonly operation?: "update";
  readonly payload: {
    readonly dateOfBirth: string;
    readonly preferredName: string;
  };
};

export type EmergencyCardSyncMutation = {
  readonly baseRevision: number | null;
  readonly entityId: UuidV7;
  readonly entityType: "emergencyCard";
  readonly idempotencyKey: UuidV7;
  readonly localDependencyIds: ReadonlyArray<UuidV7>;
  readonly mutationId: UuidV7;
  readonly operation: "create" | "update";
  readonly payload: {
    readonly accessMode: "standard";
    readonly childId: UuidV7;
    readonly content: EmergencyCardContent;
  };
};

export type SyncPersistenceMutation = ChildProfileSyncMutation | EmergencyCardSyncMutation;

export class SyncPersistenceError extends Error {
  readonly code: "authorization_denied" | "cursor_ahead" | "membership_required";

  constructor(code: SyncPersistenceError["code"], message: string) {
    super(message);
    this.name = "SyncPersistenceError";
    this.code = code;
  }
}

export type SyncPersistence = {
  readonly readEmergencyCard: (input: {
    readonly cardId: UuidV7;
    readonly identityUserId: string;
  }) => Promise<EmergencyCardProjection | null>;
  readonly pull: (input: {
    readonly afterSequence: number;
    readonly identityUserId: string;
    readonly limit: number;
  }) => Promise<{
    readonly changes: ReadonlyArray<SyncPersistenceChange>;
    readonly hasMore: boolean;
    readonly headSequence: number;
    readonly minimumSequence: number;
    readonly nextSequence: number;
  }>;
  readonly push: (input: {
    readonly identityUserId: string;
    readonly mutations: ReadonlyArray<SyncPersistenceMutation>;
  }) => Promise<ReadonlyArray<SyncMutationOutcome>>;
  readonly snapshot: (input: {
    readonly afterEntityType: "child" | "emergencyCard" | null;
    readonly afterId: UuidV7 | null;
    readonly capturedSequence: number | null;
    readonly identityUserId: string;
    readonly limit: number;
  }) => Promise<{
    readonly capturedSequence: number;
    readonly hasMore: boolean;
    readonly items: ReadonlyArray<SyncProjection>;
    readonly nextAfterEntityType: "child" | "emergencyCard" | null;
    readonly nextAfterId: UuidV7 | null;
  }>;
};

export function createSyncPersistence(options: {
  readonly crypto: StructuredPayloadCrypto;
  readonly database: DatabaseClient;
}): SyncPersistence {
  return {
    async readEmergencyCard(input) {
      return options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        if (!canReadEmergencyCard(context)) {
          throw new SyncPersistenceError(
            "authorization_denied",
            "Emergency-card access is not granted.",
          );
        }
        const row = await readEmergencyCard(transaction, context, input.cardId);
        if (!row || row.deletedAt) {
          return null;
        }
        const householdKey = await readHouseholdKey(transaction, context.householdId);
        const plaintextKey = options.crypto.unwrapHouseholdKey(householdKey);
        try {
          return projectEmergencyCard(options.crypto, context.householdId, row, plaintextKey);
        } finally {
          plaintextKey.fill(0);
        }
      });
    },

    async pull(input) {
      return options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        const boundsResult = await transaction.execute<{
          readonly headSequence: number;
          readonly minimumSequence: number;
        }>(sql`
          select
            coalesce(max(sequence), 0)::int as "headSequence",
            coalesce(min(sequence), 1)::int as "minimumSequence"
          from littlearc.change_events
          where household_id = ${context.householdId}
        `);
        const bounds = boundsResult.rows[0] ?? { headSequence: 0, minimumSequence: 1 };
        if (input.afterSequence > bounds.headSequence) {
          throw new SyncPersistenceError(
            "cursor_ahead",
            "The synchronization cursor is ahead of server authority.",
          );
        }
        const eventResult = await transaction.execute<ChangeEventRecord>(sql`
          select
            sequence::int,
            entity_type as "entityType",
            entity_id as "entityId",
            operation,
            revision,
            changed_at as "changedAt"
          from littlearc.change_events
          where household_id = ${context.householdId}
            and sequence > ${input.afterSequence}
          order by sequence
          limit ${input.limit + 1}
        `);
        const scanned = eventResult.rows.slice(0, input.limit);
        const hasMore = eventResult.rows.length > input.limit;
        const childEvents = scanned.filter(
          (event): event is ChangeEventRecord & { readonly entityType: "child" } =>
            event.entityType === "child",
        );
        const childIds = [...new Set(childEvents.map((event) => event.entityId))];
        const emergencyEvents = scanned.filter(
          (event): event is ChangeEventRecord & { readonly entityType: "emergencyCard" } =>
            event.entityType === "emergencyCard",
        );
        const cardIds = [...new Set(emergencyEvents.map((event) => event.entityId))];
        const childRows = await readChildren(transaction, context, childIds);
        const cardRows = await readEmergencyCards(transaction, context, cardIds);
        const householdKey = await readHouseholdKey(transaction, context.householdId);
        const plaintextKey = options.crypto.unwrapHouseholdKey(householdKey);
        try {
          const changes = scanned.flatMap((event): ReadonlyArray<SyncPersistenceChange> => {
            if (event.entityType === "emergencyCard") {
              if (!canReadEmergencyCard(context)) {
                return [];
              }
              if (event.operation === "delete") {
                return [
                  {
                    changedAt: normalizeTimestamp(event.changedAt),
                    entityId: event.entityId,
                    entityType: "emergencyCard",
                    operation: "delete",
                    revision: event.revision,
                    sequence: event.sequence,
                  },
                ];
              }
              const card = cardRows.get(event.entityId);
              if (!card || card.deletedAt) {
                return [];
              }
              return [
                {
                  changedAt: normalizeTimestamp(event.changedAt),
                  entity: projectEmergencyCard(
                    options.crypto,
                    context.householdId,
                    card,
                    plaintextKey,
                  ),
                  entityId: event.entityId,
                  entityType: "emergencyCard",
                  operation: "upsert",
                  revision: card.revision,
                  sequence: event.sequence,
                },
              ];
            }
            if (event.entityType !== "child") {
              return [];
            }
            if (event.operation === "delete") {
              return [
                {
                  changedAt: normalizeTimestamp(event.changedAt),
                  entityId: event.entityId,
                  entityType: "child",
                  operation: "delete",
                  revision: event.revision,
                  sequence: event.sequence,
                },
              ];
            }
            const child = childRows.get(event.entityId);
            if (!child || child.deletedAt) {
              return [];
            }
            return [
              {
                changedAt: normalizeTimestamp(event.changedAt),
                entity: projectChild(options.crypto, context.householdId, child, plaintextKey),
                entityId: event.entityId,
                entityType: "child",
                operation: "upsert",
                revision: child.revision,
                sequence: event.sequence,
              },
            ];
          });
          return {
            changes,
            hasMore,
            headSequence: bounds.headSequence,
            minimumSequence: bounds.minimumSequence,
            nextSequence: scanned.at(-1)?.sequence ?? input.afterSequence,
          };
        } finally {
          plaintextKey.fill(0);
        }
      });
    },

    async snapshot(input) {
      return options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        const headResult = await transaction.execute<{ readonly sequence: number }>(sql`
          select coalesce(max(sequence), 0)::int as sequence
          from littlearc.change_events
          where household_id = ${context.householdId}
        `);
        const headSequence = headResult.rows[0]?.sequence ?? 0;
        const capturedSequence = input.capturedSequence ?? headSequence;
        if (capturedSequence > headSequence) {
          throw new SyncPersistenceError(
            "cursor_ahead",
            "The snapshot cursor is ahead of server authority.",
          );
        }
        const rows = await transaction.execute<SnapshotEntityRecord>(sql`
          select entity_type as "entityType", id
          from (
            select 'child'::text entity_type, id
            from littlearc.children
            where household_id = ${context.householdId} and deleted_at is null
            union all
            select 'emergencyCard'::text entity_type, id
            from littlearc.emergency_cards
            where household_id = ${context.householdId}
              and deleted_at is null
              and ${canReadEmergencyCard(context)}
          ) snapshot_entities
          where ${input.afterEntityType}::text is null
            or entity_type > ${input.afterEntityType}
            or (entity_type = ${input.afterEntityType} and id > ${input.afterId})
          order by entity_type, id
          limit ${input.limit + 1}
        `);
        const page = rows.rows.slice(0, input.limit);
        const childRows = await readChildren(
          transaction,
          context,
          page.filter((item) => item.entityType === "child").map((item) => item.id),
        );
        const cardRows = await readEmergencyCards(
          transaction,
          context,
          page.filter((item) => item.entityType === "emergencyCard").map((item) => item.id),
        );
        const householdKey = await readHouseholdKey(transaction, context.householdId);
        const plaintextKey = options.crypto.unwrapHouseholdKey(householdKey);
        try {
          return {
            capturedSequence,
            hasMore: rows.rows.length > input.limit,
            items: page.flatMap((item): ReadonlyArray<SyncProjection> => {
              if (item.entityType === "child") {
                const child = childRows.get(item.id);
                return child
                  ? [projectChild(options.crypto, context.householdId, child, plaintextKey)]
                  : [];
              }
              const card = cardRows.get(item.id);
              return card
                ? [projectEmergencyCard(options.crypto, context.householdId, card, plaintextKey)]
                : [];
            }),
            nextAfterEntityType:
              rows.rows.length > input.limit ? (page.at(-1)?.entityType ?? null) : null,
            nextAfterId: rows.rows.length > input.limit ? (page.at(-1)?.id ?? null) : null,
          };
        } finally {
          plaintextKey.fill(0);
        }
      });
    },

    async push(input) {
      const results: SyncMutationOutcome[] = [];
      const batchStatuses = new Map<UuidV7, SyncMutationOutcome["status"]>();
      for (const mutation of input.mutations) {
        const result =
          mutation.entityType === "emergencyCard"
            ? await persistEmergencyCardMutation(options, {
                identityUserId: input.identityUserId,
                mutation,
                batchStatuses,
              })
            : await persistMutation(options, {
                identityUserId: input.identityUserId,
                mutation,
                batchStatuses,
              });
        results.push(result);
        batchStatuses.set(mutation.mutationId, result.status);
      }
      return results;
    },
  };
}

type SqlTransaction = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

type TenantContext = {
  readonly grantedCapabilities: ReadonlySet<HouseholdCapability>;
  readonly householdId: UuidV7;
  readonly membershipId: UuidV7;
  readonly role: HouseholdRole;
};

type ChildRecord = {
  readonly deletedAt: string | Date | null;
  readonly encryptedProfile: EncryptedEnvelopeV1;
  readonly id: UuidV7;
  readonly revision: number;
  readonly updatedAt: string | Date;
};

type EmergencyCardRecord = {
  readonly accessMode: "standard";
  readonly childId: UuidV7;
  readonly deletedAt: string | Date | null;
  readonly encryptedPayload: EncryptedEnvelopeV1;
  readonly id: UuidV7;
  readonly revision: number;
  readonly updatedAt: string | Date;
  readonly versionNumber: number;
};

type ChangeEventRecord = {
  readonly changedAt: string | Date;
  readonly entityId: UuidV7;
  readonly entityType: string;
  readonly operation: "delete" | "upsert";
  readonly revision: number;
  readonly sequence: number;
};

type SnapshotEntityRecord = {
  readonly entityType: "child" | "emergencyCard";
  readonly id: UuidV7;
};

async function establishContext(
  transaction: SqlTransaction,
  identityUserId: string,
): Promise<TenantContext> {
  await transaction.execute(sql`set local role littlearc_app`);
  await transaction.execute(
    sql`select set_config('littlearc.current_identity_user_id', ${identityUserId}, true)`,
  );
  const membershipResult = await transaction.execute<{
    readonly householdId: UuidV7;
    readonly membershipId: UuidV7;
    readonly role: HouseholdRole;
  }>(sql`
    select
      household_id as "householdId",
      id as "membershipId",
      role
    from littlearc.household_memberships
    where user_id = ${identityUserId} and status = 'active'
    limit 1
  `);
  const context = membershipResult.rows[0];
  if (!context) {
    throw new SyncPersistenceError(
      "membership_required",
      "An active household membership is required for synchronization.",
    );
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

async function readChildren(
  transaction: SqlTransaction,
  context: TenantContext,
  childIds: ReadonlyArray<UuidV7>,
): Promise<Map<UuidV7, ChildRecord>> {
  if (childIds.length === 0) {
    return new Map();
  }
  const childIdList = sql.join(
    childIds.map((childId) => sql`${childId}`),
    sql`, `,
  );
  const rows = await transaction.execute<ChildRecord>(sql`
    select
      id,
      encrypted_profile as "encryptedProfile",
      revision,
      updated_at as "updatedAt",
      deleted_at as "deletedAt"
    from littlearc.children
    where household_id = ${context.householdId}
      and id in (${childIdList})
  `);
  return new Map(rows.rows.map((row) => [row.id, row]));
}

async function readEmergencyCard(
  transaction: SqlTransaction,
  context: TenantContext,
  cardId: UuidV7,
): Promise<EmergencyCardRecord | undefined> {
  const result = await transaction.execute<EmergencyCardRecord>(sql`
    select
      card.id,
      card.child_id as "childId",
      card.access_mode as "accessMode",
      card.revision,
      card.updated_at as "updatedAt",
      card.deleted_at as "deletedAt",
      version.version_number as "versionNumber",
      version.encrypted_payload as "encryptedPayload"
    from littlearc.emergency_cards card
    join littlearc.emergency_card_versions version
      on version.household_id = card.household_id
      and version.emergency_card_id = card.id
      and version.id = card.current_version_id
    where card.household_id = ${context.householdId}
      and card.id = ${cardId}
    limit 1
  `);
  return result.rows[0];
}

async function readEmergencyCards(
  transaction: SqlTransaction,
  context: TenantContext,
  cardIds: ReadonlyArray<UuidV7>,
): Promise<Map<UuidV7, EmergencyCardRecord>> {
  if (cardIds.length === 0 || !canReadEmergencyCard(context)) {
    return new Map();
  }
  const cardIdList = sql.join(
    cardIds.map((cardId) => sql`${cardId}`),
    sql`, `,
  );
  const rows = await transaction.execute<EmergencyCardRecord>(sql`
    select
      card.id,
      card.child_id as "childId",
      card.access_mode as "accessMode",
      card.revision,
      card.updated_at as "updatedAt",
      card.deleted_at as "deletedAt",
      version.version_number as "versionNumber",
      version.encrypted_payload as "encryptedPayload"
    from littlearc.emergency_cards card
    join littlearc.emergency_card_versions version
      on version.household_id = card.household_id
      and version.emergency_card_id = card.id
      and version.id = card.current_version_id
    where card.household_id = ${context.householdId}
      and card.id in (${cardIdList})
  `);
  return new Map(rows.rows.map((row) => [row.id, row]));
}

async function persistEmergencyCardMutation(
  options: { readonly crypto: StructuredPayloadCrypto; readonly database: DatabaseClient },
  input: {
    readonly batchStatuses: ReadonlyMap<UuidV7, SyncMutationOutcome["status"]>;
    readonly identityUserId: string;
    readonly mutation: EmergencyCardSyncMutation;
  },
): Promise<SyncMutationOutcome> {
  return options.database.transaction(async (transaction) => {
    const context = await establishContext(transaction, input.identityUserId);
    const mutation = input.mutation;
    let requestFingerprint: string;
    try {
      assertEmergencyCardContent(mutation.payload.content);
      requestFingerprint = fingerprint(mutation);
    } catch {
      return rejected(mutation, "validationFailed");
    }
    const replayResult = await transaction.execute<{
      readonly requestFingerprint: string;
      readonly responseBody: { readonly revision?: number; readonly status: string };
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
      return replayEmergencyCardMutation(
        transaction,
        options.crypto,
        context,
        mutation,
        replay.responseBody,
      );
    }

    for (const dependencyId of mutation.localDependencyIds) {
      const batchStatus = input.batchStatuses.get(dependencyId);
      if (batchStatus) {
        if (batchStatus !== "applied" && batchStatus !== "duplicate") {
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

    if (!canEditEmergencyCard(context)) {
      return rejected(mutation, "authorizationDenied");
    }
    const child = await transaction.execute<{ readonly id: UuidV7 }>(sql`
      select id
      from littlearc.children
      where household_id = ${context.householdId}
        and id = ${mutation.payload.childId}
        and deleted_at is null
      limit 1
    `);
    if (!child.rows[0]) {
      return rejected(mutation, "authorizationDenied");
    }

    const current = await readEmergencyCardForUpdate(transaction, context, mutation.entityId);
    if (mutation.operation === "create" && mutation.baseRevision !== null) {
      return rejected(mutation, "validationFailed");
    }
    if (mutation.operation === "update" && mutation.baseRevision === null) {
      return rejected(mutation, "validationFailed");
    }
    if (current && current.childId !== mutation.payload.childId) {
      return rejected(mutation, "authorizationDenied");
    }
    if (current?.deletedAt) {
      await persistTerminalResult(transaction, context, mutation, requestFingerprint, {
        status: "rejected",
      });
      return rejected(mutation, "tombstoneWins");
    }

    const householdKey = await readHouseholdKey(transaction, context.householdId);
    const plaintextKey = options.crypto.unwrapHouseholdKey(householdKey);
    try {
      if (current && current.revision !== mutation.baseRevision) {
        await persistTerminalResult(transaction, context, mutation, requestFingerprint, {
          revision: current.revision,
          status: "conflict",
        });
        await insertEmergencyCardFailureAudit(
          transaction,
          context,
          mutation,
          "stale_critical_revision",
        );
        return {
          current: projectEmergencyCard(options.crypto, context.householdId, current, plaintextKey),
          entityId: mutation.entityId,
          mutationId: mutation.mutationId,
          reason: "staleCriticalRevision",
          status: "conflict",
        };
      }
      if (!current && mutation.operation !== "create") {
        return rejected(mutation, "authorizationDenied");
      }

      const nextRevision = (current?.revision ?? 0) + 1;
      const nextVersion = (current?.versionNumber ?? 0) + 1;
      const envelope = options.crypto.encrypt(
        mutation.payload.content as unknown as Record<string, unknown>,
        {
          aadSchemaVersion: 1,
          householdId: context.householdId,
          objectId: mutation.entityId,
          objectType: "emergency_card",
        },
        plaintextKey,
        householdKey.keyVersion,
      );
      if (!current) {
        await transaction.execute(sql`
          insert into littlearc.emergency_cards (
            id, household_id, child_id, access_mode, status,
            created_by, updated_by, revision
          ) values (
            ${mutation.entityId}, ${context.householdId}, ${mutation.payload.childId},
            'standard', 'active', ${context.membershipId}, ${context.membershipId}, 1
          )
        `);
      }
      await transaction.execute(sql`
        insert into littlearc.emergency_card_versions (
          id, household_id, emergency_card_id, version_number,
          encrypted_payload, confirmed_by, source_revision
        ) values (
          ${mutation.mutationId}, ${context.householdId}, ${mutation.entityId},
          ${nextVersion}, ${JSON.stringify(envelope)}::jsonb,
          ${context.membershipId}, ${nextRevision}
        )
      `);
      const updated = await transaction.execute<EmergencyCardRecord>(sql`
        update littlearc.emergency_cards
        set
          current_version_id = ${mutation.mutationId},
          access_mode = 'standard',
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
          access_mode as "accessMode",
          revision,
          updated_at as "updatedAt",
          deleted_at as "deletedAt",
          ${nextVersion}::int as "versionNumber",
          ${JSON.stringify(envelope)}::jsonb as "encryptedPayload"
      `);
      const row = updated.rows[0];
      if (!row) {
        throw new Error("The emergency-card revision changed while applying the mutation.");
      }
      await transaction.execute(sql`
        insert into littlearc.audit_events (
          id, household_id, actor_id, actor_role, action, target_type,
          target_id, request_id, result, metadata
        ) values (
          ${mutation.mutationId}, ${context.householdId}, ${context.membershipId},
          ${context.role}, ${current ? "emergency_card_updated" : "emergency_card_created"},
          'emergency_card', ${mutation.entityId}, ${mutation.mutationId}, 'success',
          ${JSON.stringify({ fromRevision: current?.revision ?? null, toRevision: nextRevision, version: nextVersion })}::jsonb
        )
      `);
      await transaction.execute(sql`
        insert into littlearc.change_events (
          household_id, entity_type, entity_id, operation, revision,
          actor_id, mutation_id, payload
        ) values (
          ${context.householdId}, 'emergencyCard', ${mutation.entityId}, 'upsert',
          ${nextRevision}, ${context.membershipId}, ${mutation.mutationId},
          ${JSON.stringify({ schemaVersion: 1, version: nextVersion })}::jsonb
        )
      `);
      await transaction.execute(sql`
        insert into littlearc.outbox_events (
          id, household_id, event_type, aggregate_type, aggregate_id, payload
        ) values (
          ${mutation.mutationId}, ${context.householdId}, 'emergency_card_version_confirmed',
          'emergency_card', ${mutation.entityId},
          ${JSON.stringify({ revision: nextRevision, schemaVersion: 1, version: nextVersion })}::jsonb
        )
      `);
      await persistTerminalResult(transaction, context, mutation, requestFingerprint, {
        revision: nextRevision,
        status: "applied",
      });
      return {
        entity: projectEmergencyCard(options.crypto, context.householdId, row, plaintextKey),
        entityId: mutation.entityId,
        mutationId: mutation.mutationId,
        status: "applied",
      };
    } finally {
      plaintextKey.fill(0);
    }
  });
}

async function readEmergencyCardForUpdate(
  transaction: SqlTransaction,
  context: TenantContext,
  cardId: UuidV7,
): Promise<EmergencyCardRecord | undefined> {
  const result = await transaction.execute<EmergencyCardRecord>(sql`
    select
      card.id,
      card.child_id as "childId",
      card.access_mode as "accessMode",
      card.revision,
      card.updated_at as "updatedAt",
      card.deleted_at as "deletedAt",
      version.version_number as "versionNumber",
      version.encrypted_payload as "encryptedPayload"
    from littlearc.emergency_cards card
    join littlearc.emergency_card_versions version
      on version.household_id = card.household_id
      and version.emergency_card_id = card.id
      and version.id = card.current_version_id
    where card.household_id = ${context.householdId}
      and card.id = ${cardId}
    for update of card
  `);
  return result.rows[0];
}

async function replayEmergencyCardMutation(
  transaction: SqlTransaction,
  crypto: StructuredPayloadCrypto,
  context: TenantContext,
  mutation: EmergencyCardSyncMutation,
  response: { readonly revision?: number; readonly status: string },
): Promise<SyncMutationOutcome> {
  const card = await readEmergencyCard(transaction, context, mutation.entityId);
  if (!card || card.deletedAt) {
    return rejected(mutation, "tombstoneWins");
  }
  const householdKey = await readHouseholdKey(transaction, context.householdId);
  const plaintextKey = crypto.unwrapHouseholdKey(householdKey);
  try {
    const projection = projectEmergencyCard(crypto, context.householdId, card, plaintextKey);
    if (response.status === "applied") {
      return {
        entity: projection,
        entityId: mutation.entityId,
        mutationId: mutation.mutationId,
        status: "duplicate",
      };
    }
    if (response.status === "conflict") {
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

async function insertEmergencyCardFailureAudit(
  transaction: SqlTransaction,
  context: TenantContext,
  mutation: EmergencyCardSyncMutation,
  failureCode: string,
): Promise<void> {
  await transaction.execute(sql`
    insert into littlearc.audit_events (
      id, household_id, actor_id, actor_role, action, target_type,
      target_id, request_id, result, failure_code, metadata
    ) values (
      ${mutation.mutationId}, ${context.householdId}, ${context.membershipId},
      ${context.role}, 'emergency_card_updated', 'emergency_card',
      ${mutation.entityId}, ${mutation.mutationId}, 'failure', ${failureCode},
      ${JSON.stringify({ submittedBaseRevision: mutation.baseRevision })}::jsonb
    )
  `);
}

async function persistMutation(
  options: { readonly crypto: StructuredPayloadCrypto; readonly database: DatabaseClient },
  input: {
    readonly batchStatuses: ReadonlyMap<UuidV7, SyncMutationOutcome["status"]>;
    readonly identityUserId: string;
    readonly mutation: ChildProfileSyncMutation;
  },
): Promise<SyncMutationOutcome> {
  return options.database.transaction(async (transaction) => {
    const context = await establishContext(transaction, input.identityUserId);
    const mutation = input.mutation;
    const requestFingerprint = fingerprint(mutation);
    const replayResult = await transaction.execute<{
      readonly requestFingerprint: string;
      readonly responseBody: { readonly revision?: number; readonly status: string };
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
      return replayMutation(transaction, options.crypto, context, mutation, replay.responseBody);
    }

    for (const dependencyId of mutation.localDependencyIds) {
      const batchStatus = input.batchStatuses.get(dependencyId);
      if (batchStatus) {
        if (batchStatus !== "applied" && batchStatus !== "duplicate") {
          return rejected(mutation, "dependencyFailed");
        }
        continue;
      }
      const dependency = await transaction.execute<{
        readonly status: string;
      }>(sql`
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

    if (context.role !== "owner") {
      return rejected(mutation, "authorizationDenied");
    }
    const childResult = await transaction.execute<ChildRecord>(sql`
      select
        id,
        encrypted_profile as "encryptedProfile",
        revision,
        updated_at as "updatedAt",
        deleted_at as "deletedAt"
      from littlearc.children
      where household_id = ${context.householdId} and id = ${mutation.entityId}
      for update
    `);
    const child = childResult.rows[0];
    if (!child) {
      return rejected(mutation, "authorizationDenied");
    }
    if (child.deletedAt) {
      await persistTerminalResult(transaction, context, mutation, requestFingerprint, {
        status: "rejected",
      });
      return rejected(mutation, "tombstoneWins");
    }

    const householdKey = await readHouseholdKey(transaction, context.householdId);
    const plaintextKey = options.crypto.unwrapHouseholdKey(householdKey);
    try {
      if (child.revision !== mutation.baseRevision) {
        await persistTerminalResult(transaction, context, mutation, requestFingerprint, {
          revision: child.revision,
          status: "conflict",
        });
        await insertFailureAudit(transaction, context, mutation, "stale_critical_revision");
        return {
          current: projectChild(options.crypto, context.householdId, child, plaintextKey),
          entityId: mutation.entityId,
          mutationId: mutation.mutationId,
          reason: "staleCriticalRevision",
          status: "conflict",
        };
      }
      const nextRevision = child.revision + 1;
      const envelope = options.crypto.encrypt(
        mutation.payload,
        {
          aadSchemaVersion: 1,
          householdId: context.householdId,
          objectId: mutation.entityId,
          objectType: "child_profile",
        },
        plaintextKey,
        householdKey.keyVersion,
      );
      const updated = await transaction.execute<ChildRecord>(sql`
        update littlearc.children
        set
          encrypted_profile = ${JSON.stringify(envelope)}::jsonb,
          revision = ${nextRevision},
          updated_by = ${context.membershipId},
          updated_at = now()
        where household_id = ${context.householdId}
          and id = ${mutation.entityId}
          and revision = ${mutation.baseRevision}
          and deleted_at is null
        returning
          id,
          encrypted_profile as "encryptedProfile",
          revision,
          updated_at as "updatedAt",
          deleted_at as "deletedAt"
      `);
      const row = updated.rows[0];
      if (!row) {
        throw new Error("The child revision changed while applying the mutation.");
      }
      await transaction.execute(sql`
        insert into littlearc.audit_events (
          id, household_id, actor_id, actor_role, action, target_type,
          target_id, request_id, result, metadata
        ) values (
          ${mutation.mutationId}, ${context.householdId}, ${context.membershipId},
          ${context.role}, 'child_updated', 'child', ${mutation.entityId},
          ${mutation.mutationId}, 'success',
          ${JSON.stringify({ fromRevision: child.revision, toRevision: nextRevision })}::jsonb
        )
      `);
      await transaction.execute(sql`
        insert into littlearc.change_events (
          household_id, entity_type, entity_id, operation, revision,
          actor_id, mutation_id, payload
        ) values (
          ${context.householdId}, 'child', ${mutation.entityId}, 'upsert',
          ${nextRevision}, ${context.membershipId}, ${mutation.mutationId},
          ${JSON.stringify({ encryptedProfile: envelope, schemaVersion: 1 })}::jsonb
        )
      `);
      await transaction.execute(sql`
        insert into littlearc.outbox_events (
          id, household_id, event_type, aggregate_type, aggregate_id, payload
        ) values (
          ${mutation.mutationId}, ${context.householdId}, 'child_profile_updated',
          'child', ${mutation.entityId},
          ${JSON.stringify({ revision: nextRevision, schemaVersion: 1 })}::jsonb
        )
      `);
      await persistTerminalResult(transaction, context, mutation, requestFingerprint, {
        revision: nextRevision,
        status: "applied",
      });
      return {
        entity: projectChild(options.crypto, context.householdId, row, plaintextKey),
        entityId: mutation.entityId,
        mutationId: mutation.mutationId,
        status: "applied",
      };
    } finally {
      plaintextKey.fill(0);
    }
  });
}

async function replayMutation(
  transaction: SqlTransaction,
  crypto: StructuredPayloadCrypto,
  context: TenantContext,
  mutation: ChildProfileSyncMutation,
  response: { readonly revision?: number; readonly status: string },
): Promise<SyncMutationOutcome> {
  const childResult = await transaction.execute<ChildRecord>(sql`
    select
      id,
      encrypted_profile as "encryptedProfile",
      revision,
      updated_at as "updatedAt",
      deleted_at as "deletedAt"
    from littlearc.children
    where household_id = ${context.householdId} and id = ${mutation.entityId}
  `);
  const child = childResult.rows[0];
  if (!child || child.deletedAt) {
    return rejected(mutation, "tombstoneWins");
  }
  const householdKey = await readHouseholdKey(transaction, context.householdId);
  const plaintextKey = crypto.unwrapHouseholdKey(householdKey);
  try {
    const projection = projectChild(crypto, context.householdId, child, plaintextKey);
    if (response.status === "applied") {
      return {
        entity: projection,
        entityId: mutation.entityId,
        mutationId: mutation.mutationId,
        status: "duplicate",
      };
    }
    if (response.status === "conflict") {
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

async function persistTerminalResult(
  transaction: SqlTransaction,
  context: TenantContext,
  mutation: SyncPersistenceMutation,
  requestFingerprint: string,
  responseBody: { readonly revision?: number; readonly status: string },
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
  context: TenantContext,
  mutation: ChildProfileSyncMutation,
  failureCode: string,
): Promise<void> {
  await transaction.execute(sql`
    insert into littlearc.audit_events (
      id, household_id, actor_id, actor_role, action, target_type,
      target_id, request_id, result, failure_code, metadata
    ) values (
      ${mutation.mutationId}, ${context.householdId}, ${context.membershipId},
      ${context.role}, 'child_updated', 'child', ${mutation.entityId},
      ${mutation.mutationId}, 'failure', ${failureCode},
      ${JSON.stringify({ submittedBaseRevision: mutation.baseRevision })}::jsonb
    )
  `);
}

function projectChild(
  crypto: StructuredPayloadCrypto,
  householdId: UuidV7,
  row: ChildRecord,
  plaintextKey: Buffer,
): ChildProfileProjection {
  const payload = crypto.decrypt(
    row.encryptedProfile,
    {
      aadSchemaVersion: 1,
      householdId,
      objectId: row.id,
      objectType: "child_profile",
    },
    plaintextKey,
  );
  const child = parseChildPayload(payload);
  return {
    childId: row.id,
    ...child,
    revision: row.revision,
    updatedAt: normalizeTimestamp(row.updatedAt),
  };
}

function projectEmergencyCard(
  crypto: StructuredPayloadCrypto,
  householdId: UuidV7,
  row: EmergencyCardRecord,
  plaintextKey: Buffer,
): EmergencyCardProjection {
  const payload = crypto.decrypt(
    row.encryptedPayload,
    {
      aadSchemaVersion: 1,
      householdId,
      objectId: row.id,
      objectType: "emergency_card",
    },
    plaintextKey,
  );
  const content = parseEmergencyCardPayload(payload);
  return {
    accessMode: row.accessMode,
    cardId: row.id,
    childId: row.childId,
    content,
    revision: row.revision,
    updatedAt: normalizeTimestamp(row.updatedAt),
    version: row.versionNumber,
  };
}

function parseEmergencyCardPayload(value: unknown): EmergencyCardContent {
  assertEmergencyCardContent(value as EmergencyCardContent);
  return value as EmergencyCardContent;
}

function parseChildPayload(value: unknown): {
  readonly dateOfBirth: string;
  readonly preferredName: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The decrypted child profile is invalid.");
  }
  const candidate = value as { readonly dateOfBirth?: unknown; readonly preferredName?: unknown };
  if (
    typeof candidate.dateOfBirth !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(candidate.dateOfBirth) ||
    typeof candidate.preferredName !== "string" ||
    candidate.preferredName.length < 1 ||
    candidate.preferredName.length > 120
  ) {
    throw new Error("The decrypted child profile is invalid.");
  }
  return {
    dateOfBirth: candidate.dateOfBirth,
    preferredName: candidate.preferredName,
  };
}

function fingerprint(mutation: SyncPersistenceMutation): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        baseRevision: mutation.baseRevision,
        entityType: mutation.entityType ?? "child",
        entityId: mutation.entityId,
        localDependencyIds: mutation.localDependencyIds,
        mutationId: mutation.mutationId,
        operation: mutation.operation ?? "update",
        payload: mutation.payload,
      }),
    )
    .digest("hex")}`;
}

function rejected(
  mutation: SyncPersistenceMutation,
  reason: Extract<SyncMutationOutcome, { readonly status: "rejected" }>["reason"],
): SyncMutationOutcome {
  return {
    entityId: mutation.entityId,
    mutationId: mutation.mutationId,
    reason,
    status: "rejected",
  };
}

function normalizeTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
