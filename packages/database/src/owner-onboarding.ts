import type { EncryptedEnvelopeV1, WrappedHouseholdKey } from "@littlearc/crypto";
import type { UuidV7 } from "@littlearc/domain";
import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./client.js";

export type OwnerOnboardingIdentifiers = {
  readonly childDataConsentId: UuidV7;
  readonly childId: UuidV7;
  readonly householdId: UuidV7;
  readonly householdKeyId: UuidV7;
  readonly membershipId: UuidV7;
  readonly parentNoticeConsentId: UuidV7;
  readonly parentProfileId: UuidV7;
};

export type OwnerOnboardingResponse = Omit<OwnerOnboardingIdentifiers, "householdKeyId"> & {
  readonly replayed: boolean;
};

export type PersistOwnerOnboardingInput = {
  readonly childEnvelope: EncryptedEnvelopeV1;
  readonly countryCode: string;
  readonly idempotencyKey: UuidV7;
  readonly identityUserId: string;
  readonly identifiers: OwnerOnboardingIdentifiers;
  readonly parentEnvelope: EncryptedEnvelopeV1;
  readonly requestFingerprint: string;
  readonly requestId: UuidV7;
  readonly timeZone: string;
  readonly wrappedHouseholdKey: WrappedHouseholdKey;
};

export class OwnerOnboardingPersistenceError extends Error {
  readonly code: "idempotency_mismatch" | "identity_already_enrolled";

  constructor(code: OwnerOnboardingPersistenceError["code"], message: string) {
    super(message);
    this.name = "OwnerOnboardingPersistenceError";
    this.code = code;
  }
}

export async function persistOwnerOnboarding(
  database: DatabaseClient,
  input: PersistOwnerOnboardingInput,
): Promise<OwnerOnboardingResponse> {
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`set local role littlearc_app`);
    await transaction.execute(
      sql`select set_config('littlearc.current_identity_user_id', ${input.identityUserId}, true)`,
    );

    const existing = await transaction.execute<{
      readonly householdId: string;
      readonly membershipId: string;
    }>(sql`
      select household_id as "householdId", id as "membershipId"
      from littlearc.household_memberships
      where user_id = ${input.identityUserId} and status = 'active'
      limit 1
    `);
    const membership = existing.rows[0];
    if (membership) {
      await setTenantContext(transaction, {
        householdId: membership.householdId,
        identityUserId: input.identityUserId,
        membershipId: membership.membershipId,
      });
      const replay = await transaction.execute<{
        readonly requestFingerprint: string;
        readonly responseBody: OwnerOnboardingResponse;
      }>(sql`
        select
          request_fingerprint as "requestFingerprint",
          response_body as "responseBody"
        from littlearc.idempotency_results
        where household_id = ${membership.householdId}
          and actor_id = ${membership.membershipId}
          and idempotency_key = ${input.idempotencyKey}
      `);
      const prior = replay.rows[0];
      if (!prior) {
        throw new OwnerOnboardingPersistenceError(
          "identity_already_enrolled",
          "The authenticated identity already has an active household.",
        );
      }
      if (prior.requestFingerprint !== input.requestFingerprint) {
        throw new OwnerOnboardingPersistenceError(
          "idempotency_mismatch",
          "Idempotency-Key replay used a different request.",
        );
      }
      return { ...prior.responseBody, replayed: true };
    }

    const ids = input.identifiers;
    await setTenantContext(transaction, {
      householdId: ids.householdId,
      identityUserId: input.identityUserId,
      membershipId: ids.membershipId,
    });
    await transaction.execute(sql`
      insert into littlearc.households (
        id, status, default_country_code, access_policy, created_by, updated_by
      ) values (
        ${ids.householdId}, 'active', ${input.countryCode}, 'owner-managed',
        ${ids.membershipId}, ${ids.membershipId}
      )
    `);
    await transaction.execute(sql`
      insert into littlearc.household_memberships (
        id, household_id, user_id, role, status, accepted_at
      ) values (
        ${ids.membershipId}, ${ids.householdId}, ${input.identityUserId},
        'owner', 'active', now()
      )
    `);
    await transaction.execute(sql`
      insert into littlearc.household_keys (
        id, household_id, key_version, wrapped_key, wrap_nonce,
        wrapping_key_version, algorithm, status
      ) values (
        ${ids.householdKeyId}, ${ids.householdId},
        ${input.wrappedHouseholdKey.keyVersion},
        ${input.wrappedHouseholdKey.wrappedKey},
        ${input.wrappedHouseholdKey.wrapNonce},
        ${input.wrappedHouseholdKey.wrappingKeyVersion},
        'AES-256-GCM', 'active'
      )
    `);
    await transaction.execute(sql`
      insert into littlearc.user_profiles (
        id, household_id, user_id, membership_id, encrypted_profile,
        country_code, time_zone
      ) values (
        ${ids.parentProfileId}, ${ids.householdId}, ${input.identityUserId},
        ${ids.membershipId}, ${JSON.stringify(input.parentEnvelope)}::jsonb,
        ${input.countryCode}, ${input.timeZone}
      )
    `);
    await transaction.execute(sql`
      insert into littlearc.children (
        id, household_id, encrypted_profile, access_policy, created_by, updated_by
      ) values (
        ${ids.childId}, ${ids.householdId}, ${JSON.stringify(input.childEnvelope)}::jsonb,
        '{"role":"owner","capabilities":[]}'::jsonb,
        ${ids.membershipId}, ${ids.membershipId}
      )
    `);
    await insertConsentEvents(transaction, input);
    await insertAuditAndOperationalEvents(transaction, input);

    const response: OwnerOnboardingResponse = {
      childDataConsentId: ids.childDataConsentId,
      childId: ids.childId,
      householdId: ids.householdId,
      membershipId: ids.membershipId,
      parentNoticeConsentId: ids.parentNoticeConsentId,
      parentProfileId: ids.parentProfileId,
      replayed: false,
    };
    await transaction.execute(sql`
      insert into littlearc.idempotency_results (
        household_id, actor_id, idempotency_key, mutation_id,
        request_fingerprint, response_status, response_body, expires_at
      ) values (
        ${ids.householdId}, ${ids.membershipId}, ${input.idempotencyKey}, ${input.requestId},
        ${input.requestFingerprint}, 201, ${JSON.stringify(response)}::jsonb,
        now() + interval '24 hours'
      )
    `);
    return response;
  });
}

type SqlTransaction = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

async function setTenantContext(
  transaction: SqlTransaction,
  context: {
    readonly householdId: string;
    readonly identityUserId: string;
    readonly membershipId: string;
  },
): Promise<void> {
  await transaction.execute(sql`
    select
      set_config('littlearc.current_household_id', ${context.householdId}, true),
      set_config('littlearc.current_actor_id', ${context.membershipId}, true),
      set_config('littlearc.current_actor_role', 'owner', true),
      set_config('littlearc.current_identity_user_id', ${context.identityUserId}, true)
  `);
}

async function insertConsentEvents(
  transaction: SqlTransaction,
  input: PersistOwnerOnboardingInput,
): Promise<void> {
  const ids = input.identifiers;
  await transaction.execute(sql`
    insert into littlearc.consent_events (
      id, household_id, actor_membership_id, child_id, purpose,
      state, notice_version, request_id, disclosure
    ) values
      (
        ${ids.parentNoticeConsentId}, ${ids.householdId}, ${ids.membershipId}, null,
        'parent_notice', 'granted', 'parent-notice-v1', ${input.requestId},
        '{"dataCategories":["adult_profile"],"providerClass":"none"}'::jsonb
      ),
      (
        ${ids.childDataConsentId}, ${ids.householdId}, ${ids.membershipId}, ${ids.childId},
        'child_data_processing', 'granted', 'child-data-processing-v1', ${input.requestId},
        '{"dataCategories":["child_profile"],"providerClass":"none"}'::jsonb
      )
  `);
}

async function insertAuditAndOperationalEvents(
  transaction: SqlTransaction,
  input: PersistOwnerOnboardingInput,
): Promise<void> {
  const ids = input.identifiers;
  await transaction.execute(sql`
    insert into littlearc.audit_events (
      id, household_id, actor_id, actor_role, action, target_type,
      target_id, request_id, result, metadata
    ) values
      (
        ${ids.householdId}, ${ids.householdId}, ${ids.membershipId}, 'owner',
        'household_created', 'household', ${ids.householdId}, ${input.requestId},
        'success', '{"revision":1}'::jsonb
      ),
      (
        ${ids.parentNoticeConsentId}, ${ids.householdId}, ${ids.membershipId}, 'owner',
        'consent_recorded', 'consent', ${ids.parentNoticeConsentId}, ${input.requestId},
        'success', '{"noticeVersion":"parent-notice-v1"}'::jsonb
      ),
      (
        ${ids.childDataConsentId}, ${ids.householdId}, ${ids.membershipId}, 'owner',
        'consent_recorded', 'consent', ${ids.childDataConsentId}, ${input.requestId},
        'success', '{"noticeVersion":"child-data-processing-v1"}'::jsonb
      ),
      (
        ${ids.childId}, ${ids.householdId}, ${ids.membershipId}, 'owner',
        'child_created', 'child', ${ids.childId}, ${input.requestId},
        'success', '{"revision":1}'::jsonb
      )
  `);
  await transaction.execute(sql`
    insert into littlearc.change_events (
      household_id, entity_type, entity_id, operation, revision, actor_id, mutation_id, payload
    ) values
      (
        ${ids.householdId}, 'child', ${ids.childId}, 'upsert', 1,
        ${ids.membershipId}, ${input.requestId}, '{"schemaVersion":1}'::jsonb
      ),
      (
        ${ids.householdId}, 'consent', ${ids.childDataConsentId}, 'upsert', 1,
        ${ids.membershipId}, ${input.requestId}, '{"state":"granted"}'::jsonb
      )
  `);
  await transaction.execute(sql`
    insert into littlearc.outbox_events (
      id, household_id, event_type, aggregate_type, aggregate_id, payload
    ) values (
      ${input.requestId}, ${ids.householdId}, 'owner_household_onboarded',
      'household', ${ids.householdId}, '{"schemaVersion":1}'::jsonb
    )
  `);
}
