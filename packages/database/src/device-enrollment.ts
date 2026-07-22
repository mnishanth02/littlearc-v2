import type { HouseholdRole, UuidV7 } from "@littlearc/domain";
import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./client.js";

export type DeviceEnrollmentResponse = {
  readonly deviceId: UuidV7;
  readonly enrollmentStatus: "active";
  readonly householdId: UuidV7;
  readonly localSchemaVersion: 1 | 2;
  readonly replayed: boolean;
};

export type PersistDeviceEnrollmentInput = {
  readonly appVersion: string;
  readonly deviceId: UuidV7;
  readonly identityUserId: string;
  readonly localSchemaVersion: 1 | 2;
  readonly platform: "android" | "ios";
  readonly requestId: UuidV7;
};

export class DeviceEnrollmentPersistenceError extends Error {
  readonly code: "device_unavailable" | "membership_required";

  constructor(code: DeviceEnrollmentPersistenceError["code"], message: string) {
    super(message);
    this.name = "DeviceEnrollmentPersistenceError";
    this.code = code;
  }
}

export async function persistDeviceEnrollment(
  database: DatabaseClient,
  input: PersistDeviceEnrollmentInput,
): Promise<DeviceEnrollmentResponse> {
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`set local role littlearc_app`);
    await transaction.execute(
      sql`select set_config('littlearc.current_identity_user_id', ${input.identityUserId}, true)`,
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
      where user_id = ${input.identityUserId} and status = 'active'
      limit 1
    `);
    const membership = membershipResult.rows[0];
    if (!membership) {
      throw new DeviceEnrollmentPersistenceError(
        "membership_required",
        "An active household membership is required for device enrollment.",
      );
    }

    await transaction.execute(sql`
      select
        set_config('littlearc.current_household_id', ${membership.householdId}, true),
        set_config('littlearc.current_actor_id', ${membership.membershipId}, true),
        set_config('littlearc.current_actor_role', ${membership.role}, true),
        set_config('littlearc.current_identity_user_id', ${input.identityUserId}, true)
    `);

    const existingResult = await transaction.execute<{
      readonly enrollmentStatus: "active" | "pending" | "revoked";
      readonly platform: "android" | "ios";
    }>(sql`
      select
        enrollment_status as "enrollmentStatus",
        platform
      from littlearc.devices
      where id = ${input.deviceId}
      limit 1
    `);
    const existing = existingResult.rows[0];
    if (existing) {
      if (existing.enrollmentStatus !== "active" || existing.platform !== input.platform) {
        throw new DeviceEnrollmentPersistenceError(
          "device_unavailable",
          "The device identifier cannot be enrolled.",
        );
      }
      await transaction.execute(sql`
        update littlearc.devices
        set app_version = ${input.appVersion}, last_seen_at = now(), updated_at = now()
        where id = ${input.deviceId}
      `);
      return response(input, membership.householdId, true);
    }

    const inserted = await transaction.execute(sql`
      insert into littlearc.devices (
        id, user_id, household_id, platform, app_version,
        enrollment_status, last_seen_at
      ) values (
        ${input.deviceId}, ${input.identityUserId}, ${membership.householdId},
        ${input.platform}, ${input.appVersion}, 'active', now()
      )
      on conflict (id) do nothing
      returning id
    `);
    if (inserted.rowCount !== 1) {
      throw new DeviceEnrollmentPersistenceError(
        "device_unavailable",
        "The device identifier cannot be enrolled.",
      );
    }

    await transaction.execute(sql`
      insert into littlearc.audit_events (
        id, household_id, actor_id, actor_role, action, target_type,
        target_id, request_id, result, metadata
      ) values (
        ${input.requestId}, ${membership.householdId}, ${membership.membershipId},
        ${membership.role}, 'device_enrolled', 'device', ${input.deviceId},
        ${input.requestId}, 'success',
        ${JSON.stringify({ localSchemaVersion: input.localSchemaVersion, platform: input.platform })}::jsonb
      )
    `);
    await transaction.execute(sql`
      insert into littlearc.outbox_events (
        id, household_id, event_type, aggregate_type, aggregate_id, payload
      ) values (
        ${input.deviceId}, ${membership.householdId}, 'device_enrolled',
        'device', ${input.deviceId},
        ${JSON.stringify({ localSchemaVersion: input.localSchemaVersion, platform: input.platform })}::jsonb
      )
    `);

    return response(input, membership.householdId, false);
  });
}

function response(
  input: PersistDeviceEnrollmentInput,
  householdId: UuidV7,
  replayed: boolean,
): DeviceEnrollmentResponse {
  return {
    deviceId: input.deviceId,
    enrollmentStatus: "active",
    householdId,
    localSchemaVersion: input.localSchemaVersion,
    replayed,
  };
}
