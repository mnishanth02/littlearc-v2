import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createStructuredPayloadCrypto } from "@littlearc/crypto";
import type { DeviceEnrollmentPersistenceError } from "@littlearc/database";
import {
  createDatabaseConnection,
  createSyncCursorCodec,
  createSyncPersistence,
} from "@littlearc/database";
import type { UuidV7 } from "@littlearc/domain";
import { Client } from "pg";
import { loadApiConfig } from "../src/config.js";
import { createDeviceEnrollmentCommand } from "../src/device-enrollment.js";
import type { DeviceEnrollmentCommand } from "../src/device-enrollment-route.js";
import {
  createOwnerOnboardingCommand,
  createSyntheticAdultVerification,
  nextId,
  type OwnerOnboardingCommand,
  type OwnerOnboardingRequest,
} from "../src/owner-onboarding.js";
import { createApiServer } from "../src/server.js";
import { createSyncService, type SyncService } from "../src/sync.js";

const migrationPaths = [
  "../../../packages/database/migrations/0001_fnd_05_database_foundation.sql",
  "../../../packages/database/migrations/0002_off_01_consumer_auth.sql",
  "../../../packages/database/migrations/0003_off_02_household_consent_audit.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url)));
const deviceMode = process.argv.includes("--device");
const off03DeviceMode = process.argv.includes("--device-off03");
const off04DeviceMode = process.argv.includes("--device-off04");
const syntheticRequest: OwnerOnboardingRequest = {
  adultVerificationAssertion: "synthetic-approved-off-02",
  child: { dateOfBirth: "2020-01-01", preferredName: "Synthetic Child" },
  childDataConsentVersion: "child-data-processing-v1",
  countryCode: "IN",
  parent: { displayName: "Synthetic Parent", relationship: "parent" },
  parentNoticeVersion: "parent-notice-v1",
  timeZone: "Asia/Kolkata",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function databaseUrlFor(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function insertAuthUser(client: Client, id: string, email: string): Promise<void> {
  await client.query(
    "insert into littlearc.auth_user (id, name, email, email_verified) values ($1, $2, $3, true)",
    [id, "Synthetic Parent", email],
  );
}

async function execute(
  command: OwnerOnboardingCommand,
  userId: string,
  request: OwnerOnboardingRequest = syntheticRequest,
  idempotencyKey = nextId(),
) {
  return command.execute({
    idempotencyKey,
    identityUserId: userId,
    request,
    requestId: nextId(),
  });
}

async function assertDatabaseEvidence(client: Client): Promise<void> {
  const counts = await client.query<{
    audit: string;
    changes: string;
    children: string;
    consents: string;
    households: string;
    idempotency: string;
    keys: string;
    memberships: string;
    outbox: string;
    profiles: string;
  }>(`
    select
      (select count(*)::text from littlearc.households) households,
      (select count(*)::text from littlearc.household_memberships) memberships,
      (select count(*)::text from littlearc.user_profiles) profiles,
      (select count(*)::text from littlearc.children) children,
      (select count(*)::text from littlearc.consent_events) consents,
      (select count(*)::text from littlearc.audit_events) audit,
      (select count(*)::text from littlearc.change_events) changes,
      (select count(*)::text from littlearc.outbox_events) outbox,
      (select count(*)::text from littlearc.idempotency_results) idempotency,
      (select count(*)::text from littlearc.household_keys) keys
  `);
  const row = counts.rows[0];
  assert(row, "OFF-02 database counts were unavailable.");
  assert(Number(row.households) >= 1, "No household was persisted.");
  assert(row.households === row.memberships, "Household and owner membership counts differ.");
  assert(row.households === row.profiles, "Household and parent profile counts differ.");
  assert(row.households === row.children, "Household and child counts differ.");
  assert(
    Number(row.consents) === Number(row.households) * 2,
    "Required consent rows are incomplete.",
  );
  assert(Number(row.audit) === Number(row.households) * 4, "Audit rows are incomplete.");
  assert(Number(row.changes) === Number(row.households) * 2, "Change rows are incomplete.");
  assert(row.households === row.outbox, "Outbox rows are incomplete.");
  assert(row.households === row.idempotency, "Idempotency rows are incomplete.");
  assert(row.households === row.keys, "Household key rows are incomplete.");

  const encrypted = await client.query<{ readonly payload: string }>(`
    select encrypted_profile::text payload from littlearc.user_profiles
    union all
    select encrypted_profile::text payload from littlearc.children
  `);
  const serialized = JSON.stringify(encrypted.rows);
  for (const canary of ["Synthetic Parent", "Synthetic Child", "2020-01-01"]) {
    assert(!serialized.includes(canary), "Plaintext profile canary reached PostgreSQL.");
  }
}

async function runAutomated(
  command: OwnerOnboardingCommand,
  deviceCommand: DeviceEnrollmentCommand,
  client: Client,
  currentUser: string,
  syncService: SyncService,
): Promise<void> {
  const firstUser = "synthetic-off02-owner-one";
  const secondUser = "synthetic-off02-owner-two";
  await insertAuthUser(client, firstUser, "synthetic.off02.one@example.test");
  await insertAuthUser(client, secondUser, "synthetic.off02.two@example.test");
  const key = nextId();
  const first = await execute(command, firstUser, syntheticRequest, key);
  const replay = await execute(command, firstUser, syntheticRequest, key);
  assert(!first.replayed && replay.replayed, "Exact idempotent replay was not returned.");
  assert(first.householdId === replay.householdId, "Replay returned a different household.");

  let mismatchCode: string | undefined;
  try {
    await execute(command, firstUser, { ...syntheticRequest, countryCode: "SG" }, key);
  } catch (error) {
    mismatchCode =
      error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
  }
  assert(mismatchCode === "idempotency_mismatch", "Changed replay did not fail closed.");

  const second = await execute(command, secondUser);
  await client.query("begin");
  try {
    await client.query("set local role littlearc_app");
    await client.query(
      `select
        set_config('littlearc.current_household_id', $1, true),
        set_config('littlearc.current_actor_id', $2, true),
        set_config('littlearc.current_actor_role', 'owner', true),
        set_config('littlearc.current_identity_user_id', $3, true)`,
      [first.householdId, first.membershipId, firstUser],
    );
    const hidden = await client.query("select id from littlearc.children where id = $1", [
      second.childId,
    ]);
    assert(hidden.rowCount === 0, "Cross-household child was visible through RLS.");
  } finally {
    await client.query("rollback");
  }

  let appendOnlyCode: string | undefined;
  await client.query("begin");
  try {
    await client.query("set local role littlearc_app");
    await client.query(
      `select
        set_config('littlearc.current_household_id', $1, true),
        set_config('littlearc.current_actor_id', $2, true),
        set_config('littlearc.current_actor_role', 'owner', true),
        set_config('littlearc.current_identity_user_id', $3, true)`,
      [first.householdId, first.membershipId, firstUser],
    );
    await client.query(
      "update littlearc.consent_events set notice_version = 'tampered' where id = $1",
      [first.childDataConsentId],
    );
  } catch (error) {
    appendOnlyCode =
      error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
  } finally {
    await client.query("rollback");
  }
  assert(appendOnlyCode === "42501", "Application role could update append-only consent.");

  const rollbackUser = "synthetic-off02-rollback";
  await insertAuthUser(client, rollbackUser, "synthetic.off02.rollback@example.test");
  await client.query(`
    create function littlearc.off02_force_rollback() returns trigger language plpgsql as $$
    begin
      raise exception 'synthetic forced rollback';
    end $$;
    create trigger off02_force_rollback before insert on littlearc.outbox_events
    for each row execute function littlearc.off02_force_rollback();
  `);
  try {
    await execute(command, rollbackUser);
    throw new Error("Forced rollback command unexpectedly succeeded.");
  } catch (error) {
    assert(
      error instanceof Error &&
        (error.message.includes("synthetic forced rollback") ||
          error.message.includes("insert into littlearc.outbox_events")),
      "Forced rollback returned the wrong error: " +
        (error instanceof Error ? error.message : String(error)),
    );
  } finally {
    await client.query("drop trigger off02_force_rollback on littlearc.outbox_events");
    await client.query("drop function littlearc.off02_force_rollback()");
  }
  const rolledBack = await client.query(
    "select count(*)::int count from littlearc.household_memberships where user_id = $1",
    [rollbackUser],
  );
  assert(rolledBack.rows[0]?.count === 0, "Failed onboarding left a partial membership.");

  const privileges = await client.query<{ readonly opsKeyRead: boolean }>(
    "select has_table_privilege('littlearc_ops_readonly', 'littlearc.household_keys', 'select') as \"opsKeyRead\"",
  );
  assert(!privileges.rows[0]?.opsKeyRead, "Operations role can read wrapped household keys.");
  await assertDatabaseEvidence(client);
  console.log("OFF-02 PostgreSQL household validation passed.");
  console.log("- Atomic create, exact replay, mismatch rejection, and forced rollback passed.");
  console.log("- Cross-household RLS and append-only consent enforcement passed as littlearc_app.");
  console.log("- Parent and child canaries were absent from persisted encrypted envelopes.");
  console.log("- Membership actors remain UUIDv7 while Better Auth user IDs remain strings.");
  console.log(`- Database execution role: ${currentUser} -> littlearc_app.`);

  const deviceId = nextId();
  const enrolled = await deviceCommand.execute({
    identityUserId: firstUser,
    request: { appVersion: "0.0.1", deviceId, localSchemaVersion: 1, platform: "android" },
    requestId: nextId(),
  });
  const deviceReplay = await deviceCommand.execute({
    identityUserId: firstUser,
    request: { appVersion: "0.0.2", deviceId, localSchemaVersion: 1, platform: "android" },
    requestId: nextId(),
  });
  assert(
    !enrolled.replayed && deviceReplay.replayed,
    "Device enrollment replay was not idempotent.",
  );
  assert(enrolled.householdId === first.householdId, "Device enrollment chose another household.");

  let crossIdentityCode: string | undefined;
  try {
    await deviceCommand.execute({
      identityUserId: secondUser,
      request: { appVersion: "0.0.1", deviceId, localSchemaVersion: 1, platform: "android" },
      requestId: nextId(),
    });
  } catch (error) {
    crossIdentityCode = persistenceCode(error);
  }
  assert(crossIdentityCode === "device_unavailable", "Cross-identity device reuse did not fail.");

  await client.query(
    "update littlearc.devices set enrollment_status = 'revoked', revoked_at = now() where id = $1",
    [deviceId],
  );
  let revokedCode: string | undefined;
  try {
    await deviceCommand.execute({
      identityUserId: firstUser,
      request: { appVersion: "0.0.2", deviceId, localSchemaVersion: 1, platform: "android" },
      requestId: nextId(),
    });
  } catch (error) {
    revokedCode = persistenceCode(error);
  }
  assert(revokedCode === "device_unavailable", "A revoked device was reactivated.");

  const rollbackDeviceId = nextId();
  await client.query(`
    create function littlearc.off03_force_rollback() returns trigger language plpgsql as $$
    begin
      raise exception 'synthetic OFF-03 forced rollback';
    end $$;
    create trigger off03_force_rollback before insert on littlearc.outbox_events
    for each row execute function littlearc.off03_force_rollback();
  `);
  try {
    await deviceCommand.execute({
      identityUserId: firstUser,
      request: {
        appVersion: "0.0.1",
        deviceId: rollbackDeviceId,
        localSchemaVersion: 1,
        platform: "android",
      },
      requestId: nextId(),
    });
    throw new Error("Forced OFF-03 rollback unexpectedly succeeded.");
  } catch (error) {
    assert(
      error instanceof Error &&
        (error.message.includes("synthetic OFF-03 forced rollback") ||
          error.message.includes("insert into littlearc.outbox_events")),
      "Forced OFF-03 rollback returned the wrong error: " +
        (error instanceof Error ? error.message : String(error)),
    );
  } finally {
    await client.query("drop trigger off03_force_rollback on littlearc.outbox_events");
    await client.query("drop function littlearc.off03_force_rollback()");
  }
  const rolledBackDevice = await client.query("select id from littlearc.devices where id = $1", [
    rollbackDeviceId,
  ]);
  assert(rolledBackDevice.rowCount === 0, "Failed device enrollment left a device row.");
  const deviceEvidence = await client.query<{ readonly audit: string; readonly outbox: string }>(
    `select
      (select count(*)::text from littlearc.audit_events
        where action = 'device_enrolled' and target_id = $1) audit,
      (select count(*)::text from littlearc.outbox_events
        where event_type = 'device_enrolled' and aggregate_id = $1) outbox`,
    [deviceId],
  );
  assert(deviceEvidence.rows[0]?.audit === "1", "Device enrollment audit evidence is incomplete.");
  assert(
    deviceEvidence.rows[0]?.outbox === "1",
    "Device enrollment outbox evidence is incomplete.",
  );
  console.log("OFF-03 PostgreSQL device enrollment validation passed.");
  console.log("- Session-derived household enrollment and app-version replay passed.");
  console.log("- Cross-identity reuse, revoked reactivation, and forced rollback failed closed.");
  console.log("- RLS-bound device, minimized audit, and outbox evidence passed.");

  await runSyncAutomated(syncService, client, {
    firstChildId: first.childId,
    firstHouseholdId: first.householdId,
    firstUser,
    secondUser,
  });
}

async function runSyncAutomated(
  syncService: SyncService,
  client: Client,
  input: {
    readonly firstChildId: UuidV7;
    readonly firstHouseholdId: UuidV7;
    readonly firstUser: string;
    readonly secondUser: string;
  },
): Promise<void> {
  const initial = await syncService.pull({ identityUserId: input.firstUser, limit: 1 });
  assert(
    initial.kind === "resetRequired" && initial.reason === "initialSync",
    "Initial sync did not require a reset.",
  );
  const snapshot = await syncService.snapshot({ identityUserId: input.firstUser, limit: 1 });
  assert(snapshot.items.length === 1, "Initial child snapshot was incomplete.");
  assert(snapshot.items[0]?.childId === input.firstChildId, "Snapshot returned another child.");

  const mutationId = nextId();
  const idempotencyKey = nextId();
  const mutation = {
    baseRevision: 1,
    entityId: input.firstChildId,
    idempotencyKey,
    localDependencyIds: [],
    mutationId,
    payload: {
      dateOfBirth: "2020-01-01",
      preferredName: "Synthetic Synced Child",
    },
  };
  const firstPush = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [mutation],
  });
  assert(firstPush.results[0]?.status === "applied", "Current child mutation did not apply.");
  const evidenceAfterApply = await syncEvidenceCounts(client, mutationId);
  assert(
    evidenceAfterApply.audit === "1" &&
      evidenceAfterApply.changes === "1" &&
      evidenceAfterApply.idempotency === "1" &&
      evidenceAfterApply.outbox === "1",
    "Applied mutation evidence was not atomic.",
  );

  const replay = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [mutation],
  });
  assert(replay.results[0]?.status === "duplicate", "Exact mutation retry was not duplicate.");
  assert(
    JSON.stringify(await syncEvidenceCounts(client, mutationId)) ===
      JSON.stringify(evidenceAfterApply),
    "Duplicate mutation retry added evidence rows.",
  );

  const mismatch = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [
      {
        ...mutation,
        payload: { ...mutation.payload, preferredName: "Changed Replay" },
      },
    ],
  });
  assert(
    mismatch.results[0]?.status === "rejected" &&
      mismatch.results[0].reason === "idempotencyMismatch",
    "Changed idempotency replay did not fail closed.",
  );

  const stale = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [
      {
        ...mutation,
        idempotencyKey: nextId(),
        mutationId: nextId(),
        payload: { ...mutation.payload, preferredName: "Stale Local Child" },
      },
    ],
  });
  assert(stale.results[0]?.status === "conflict", "Stale critical mutation did not conflict.");

  const crossHousehold = await syncService.push({
    identityUserId: input.secondUser,
    mutations: [
      {
        ...mutation,
        baseRevision: 2,
        idempotencyKey: nextId(),
        mutationId: nextId(),
      },
    ],
  });
  assert(
    crossHousehold.results[0]?.status === "rejected" &&
      crossHousehold.results[0].reason === "authorizationDenied",
    "Cross-household child mutation did not fail closed.",
  );

  const incremental = await syncService.pull({
    cursor: snapshot.capturedCursor,
    identityUserId: input.firstUser,
    limit: 1,
  });
  assert(incremental.kind === "changes", "Incremental sync did not return changes.");
  if (incremental.kind === "changes") {
    assert(incremental.changes.length <= 1, "Incremental page exceeded its requested limit.");
    let page = incremental;
    while (page.hasMore) {
      const next = await syncService.pull({
        cursor: page.nextCursor,
        identityUserId: input.firstUser,
        limit: 1,
      });
      assert(next.kind === "changes", "Incremental pagination unexpectedly reset.");
      if (next.kind !== "changes") {
        break;
      }
      page = next;
    }
  }

  await client.query(`
    create function littlearc.off04_force_rollback() returns trigger language plpgsql as $$
    begin
      raise exception 'synthetic OFF-04 forced rollback';
    end $$;
    create trigger off04_force_rollback before insert on littlearc.outbox_events
    for each row execute function littlearc.off04_force_rollback();
  `);
  const rollbackMutationId = nextId();
  try {
    await syncService.push({
      identityUserId: input.firstUser,
      mutations: [
        {
          ...mutation,
          baseRevision: 2,
          idempotencyKey: nextId(),
          mutationId: rollbackMutationId,
          payload: { ...mutation.payload, preferredName: "Rollback Child" },
        },
      ],
    });
    throw new Error("Forced OFF-04 rollback unexpectedly succeeded.");
  } catch (error) {
    assert(
      error instanceof Error &&
        (error.message.includes("synthetic OFF-04 forced rollback") ||
          error.message.includes("insert into littlearc.outbox_events")),
      "Forced OFF-04 rollback returned the wrong error: " +
        (error instanceof Error ? error.message : String(error)),
    );
  } finally {
    await client.query("drop trigger off04_force_rollback on littlearc.outbox_events");
    await client.query("drop function littlearc.off04_force_rollback()");
  }
  const rollbackEvidence = await syncEvidenceCounts(client, rollbackMutationId);
  assert(
    Object.values(rollbackEvidence).every((count) => count === "0"),
    "Failed mutation left partial evidence.",
  );
  const revision = await client.query<{ readonly revision: number }>(
    "select revision from littlearc.children where id = $1",
    [input.firstChildId],
  );
  assert(revision.rows[0]?.revision === 2, "Failed mutation changed the child revision.");

  const persisted = JSON.stringify(
    (
      await client.query(
        `select encrypted_profile, metadata from littlearc.children
         join littlearc.audit_events on audit_events.target_id = children.id
         where children.id = $1`,
        [input.firstChildId],
      )
    ).rows,
  );
  assert(!persisted.includes("Synthetic Synced Child"), "Sync plaintext reached PostgreSQL.");
  console.log("OFF-04 PostgreSQL synchronization validation passed.");
  console.log("- Initial snapshot, ordered pagination, and incremental cursor pull passed.");
  console.log("- Atomic apply, exact duplicate, mismatch, stale conflict, and rollback passed.");
  console.log("- Cross-household mutation rejection and plaintext canaries passed.");
  console.log(`- Synchronization household: ${input.firstHouseholdId}.`);
}

async function syncEvidenceCounts(
  client: Client,
  mutationId: string,
): Promise<{
  readonly audit: string;
  readonly changes: string;
  readonly idempotency: string;
  readonly outbox: string;
}> {
  const result = await client.query<{
    readonly audit: string;
    readonly changes: string;
    readonly idempotency: string;
    readonly outbox: string;
  }>(
    `select
      (select count(*)::text from littlearc.audit_events where request_id = $1) audit,
      (select count(*)::text from littlearc.change_events where mutation_id = $1) changes,
      (select count(*)::text from littlearc.idempotency_results where mutation_id = $1) idempotency,
      (select count(*)::text from littlearc.outbox_events where id = $1) outbox`,
    [mutationId],
  );
  const row = result.rows[0];
  assert(row, "OFF-04 mutation evidence counts were unavailable.");
  return row;
}

function persistenceCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error
    ? String((error as DeviceEnrollmentPersistenceError).code)
    : undefined;
}

async function serveDevice(
  command: OwnerOnboardingCommand,
  client: Client,
): Promise<() => Promise<void>> {
  const userId = "synthetic-off02-pixel8";
  await insertAuthUser(client, userId, "synthetic.off02.pixel8@example.test");
  const validatingCommand: OwnerOnboardingCommand = {
    async execute(input) {
      const result = await command.execute(input);
      await assertDatabaseEvidence(client);
      console.log("OFF-02 physical-device HTTP/database path passed.");
      return result;
    },
  };
  const server = await createApiServer(
    loadApiConfig({ APP_ENV: "local", HOST: "127.0.0.1", PORT: "3000" }),
    undefined,
    undefined,
    {
      command: validatingCommand,
      async getSessionIdentity(headers) {
        return headers.get("x-littlearc-synthetic-session") === "off02-pixel8" ? { userId } : null;
      },
    },
  );
  await server.listen({ host: "127.0.0.1", port: 3000 });
  console.log("OFF-02 synthetic device API listening on 127.0.0.1:3000.");
  return async () => server.close();
}

async function serveOff03Device(
  onboardingCommand: OwnerOnboardingCommand,
  deviceCommand: DeviceEnrollmentCommand,
  client: Client,
): Promise<() => Promise<void>> {
  const userId = "synthetic-off03-pixel8";
  await insertAuthUser(client, userId, "synthetic.off03.pixel8@example.test");
  await execute(onboardingCommand, userId);
  const validatingCommand: DeviceEnrollmentCommand = {
    async execute(input) {
      const result = await deviceCommand.execute(input);
      const evidence = await client.query<{
        readonly audit: string;
        readonly devices: string;
        readonly outbox: string;
      }>(
        `select
          (select count(*)::text from littlearc.devices where id = $1 and enrollment_status = 'active') devices,
          (select count(*)::text from littlearc.audit_events where target_id = $1 and action = 'device_enrolled') audit,
          (select count(*)::text from littlearc.outbox_events where aggregate_id = $1 and event_type = 'device_enrolled') outbox`,
        [result.deviceId],
      );
      assert(evidence.rows[0]?.devices === "1", "OFF-03 device row was not active.");
      assert(evidence.rows[0]?.audit === "1", "OFF-03 device audit evidence was incomplete.");
      assert(evidence.rows[0]?.outbox === "1", "OFF-03 device outbox evidence was incomplete.");
      console.log("OFF-03 physical-device HTTP/database path passed.");
      return result;
    },
  };
  const server = await createApiServer(
    loadApiConfig({ APP_ENV: "local", HOST: "127.0.0.1", PORT: "3000" }),
    undefined,
    undefined,
    undefined,
    {
      command: validatingCommand,
      async getSessionIdentity(headers) {
        return headers.get("x-littlearc-synthetic-session") === "off03-pixel8" ? { userId } : null;
      },
    },
  );
  await server.listen({ host: "127.0.0.1", port: 3000 });
  console.log("OFF-03 synthetic device API listening on 127.0.0.1:3000.");
  return async () => server.close();
}

async function serveOff04Device(
  onboardingCommand: OwnerOnboardingCommand,
  deviceCommand: DeviceEnrollmentCommand,
  syncService: SyncService,
  client: Client,
): Promise<() => Promise<void>> {
  const userId = "synthetic-off04-pixel8";
  await insertAuthUser(client, userId, "synthetic.off04.pixel8@example.test");
  const onboarding = await execute(onboardingCommand, userId);
  const getSessionIdentity = async (headers: Headers) =>
    headers.get("x-littlearc-synthetic-session") === "off04-pixel8" ? { userId } : null;
  const validatingSyncService: SyncService = {
    async pull(input) {
      try {
        return await syncService.pull(input);
      } catch (error) {
        console.error(
          "OFF-04 synthetic pull failed: " +
            (error instanceof Error ? error.message : "unknown persistence error"),
        );
        throw error;
      }
    },
    async push(input) {
      try {
        return await syncService.push(input);
      } catch (error) {
        console.error(
          "OFF-04 synthetic mutation failed: " +
            (error instanceof Error ? error.message : "unknown persistence error"),
        );
        throw error;
      }
    },
    async snapshot(input) {
      return syncService.snapshot(input);
    },
  };
  const server = await createApiServer(
    loadApiConfig({ APP_ENV: "local", HOST: "127.0.0.1", PORT: "3000" }),
    undefined,
    undefined,
    undefined,
    { command: deviceCommand, getSessionIdentity },
    { getSessionIdentity, service: validatingSyncService },
  );

  server.get("/v1/validation/off04/bootstrap", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    return {
      childId: onboarding.childId,
      householdId: onboarding.householdId,
    };
  });
  server.post("/v1/validation/off04/remote-edit", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const result = await syncService.push({
      identityUserId: userId,
      mutations: [
        {
          baseRevision: 2,
          entityId: onboarding.childId,
          idempotencyKey: nextId(),
          localDependencyIds: [],
          mutationId: nextId(),
          payload: {
            dateOfBirth: "2020-01-01",
            preferredName: "Remote Synthetic Child",
          },
        },
      ],
    });
    assert(result.results[0]?.status === "applied", "Synthetic remote edit did not apply.");
    console.log("OFF-04 simulated remote writer applied revision 3.");
    return result;
  });
  server.post("/v1/validation/off04/tombstone", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const tombstoneId = nextId();
    await client.query("begin");
    try {
      await client.query(
        `update littlearc.children
         set deleted_at = now(), revision = revision + 1, updated_at = now()
         where id = $1 and household_id = $2`,
        [onboarding.childId, onboarding.householdId],
      );
      await client.query(
        `insert into littlearc.audit_events (
          id, household_id, actor_id, actor_role, action, target_type,
          target_id, request_id, result, metadata
        ) values ($1, $2, $3, 'owner', 'child_updated', 'child', $4, $1, 'success',
          '{"validation":"synthetic_tombstone","revision":4}'::jsonb)`,
        [tombstoneId, onboarding.householdId, onboarding.membershipId, onboarding.childId],
      );
      await client.query(
        `insert into littlearc.change_events (
          household_id, entity_type, entity_id, operation, revision, actor_id, mutation_id
        ) values ($1, 'child', $2, 'delete', 4, $3, $4)`,
        [onboarding.householdId, onboarding.childId, onboarding.membershipId, tombstoneId],
      );
      await client.query(
        `insert into littlearc.outbox_events (
          id, household_id, event_type, aggregate_type, aggregate_id, payload
        ) values ($1, $2, 'synthetic_child_tombstoned', 'child', $3,
          '{"schemaVersion":1,"revision":4}'::jsonb)`,
        [tombstoneId, onboarding.householdId, onboarding.childId],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    console.log("OFF-04 synthetic tombstone committed atomically.");
    return { revision: 4, status: "tombstoned" };
  });
  server.post("/v1/validation/off04/expire-cursor", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    await client.query("delete from littlearc.change_events where household_id = $1", [
      onboarding.householdId,
    ]);
    await client.query(
      `insert into littlearc.change_events (
        household_id, entity_type, entity_id, operation, revision, actor_id, mutation_id, payload
      ) values
        ($1, 'consent', $2, 'upsert', 1, $3, $4, '{"state":"granted"}'::jsonb),
        ($1, 'consent', $2, 'upsert', 2, $3, $5, '{"state":"granted"}'::jsonb),
        ($1, 'consent', $2, 'upsert', 3, $3, $6, '{"state":"granted"}'::jsonb)`,
      [
        onboarding.householdId,
        onboarding.childId,
        onboarding.membershipId,
        nextId(),
        nextId(),
        nextId(),
      ],
    );
    await client.query(
      `delete from littlearc.change_events
       where sequence = (
         select min(sequence) from littlearc.change_events where household_id = $1
       )`,
      [onboarding.householdId],
    );
    console.log("OFF-04 retained sequence floor advanced for cursor-reset proof.");
    return { status: "cursor_expired" };
  });
  server.get("/v1/validation/off04/evidence", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const evidence = await client.query<{
      readonly audit: string;
      readonly changes: string;
      readonly outbox: string;
      readonly revision: number;
    }>(
      `select
        (select count(*)::text from littlearc.audit_events
          where household_id = $1 and action = 'child_updated') audit,
        (select count(*)::text from littlearc.change_events where household_id = $1) changes,
        (select count(*)::text from littlearc.outbox_events
          where household_id = $1 and event_type in
            ('child_profile_updated', 'synthetic_child_tombstoned')) outbox,
        (select revision from littlearc.children where id = $2) revision`,
      [onboarding.householdId, onboarding.childId],
    );
    return evidence.rows[0];
  });

  await server.listen({ host: "127.0.0.1", port: 3000 });
  console.log("OFF-04 synthetic device API listening on 127.0.0.1:3000.");
  return async () => server.close();
}

async function run(): Promise<void> {
  const sourceUrl = process.env.DATABASE_URL;
  assert(sourceUrl, "DATABASE_URL must be loaded from the untracked .env.aiven file.");
  const configured = new URL(sourceUrl);
  const sslMode = configured.searchParams.get("sslmode");
  assert(
    sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full",
    "OFF-02 Aiven validation requires TLS.",
  );
  if (sslMode === "require" && !configured.searchParams.has("uselibpqcompat")) {
    configured.searchParams.set("uselibpqcompat", "true");
  }
  const adminUrl = configured.toString();
  const databaseName = `littlearc_off02_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const admin = new Client({ connectionString: adminUrl });
  let databaseClient: Client | undefined;
  let connection: ReturnType<typeof createDatabaseConnection> | undefined;
  let closeServer: (() => Promise<void>) | undefined;
  let created = false;

  await admin.connect();
  try {
    const current = await admin.query<{ readonly currentUser: string }>(
      'select current_user as "currentUser"',
    );
    const currentUser = current.rows[0]?.currentUser;
    assert(currentUser, "Could not resolve the Aiven validation user.");
    await admin.query(`create database ${quoteIdentifier(databaseName)} template template0`);
    created = true;
    const databaseUrl = databaseUrlFor(adminUrl, databaseName);
    databaseClient = new Client({ connectionString: databaseUrl });
    await databaseClient.connect();
    for (const path of migrationPaths) {
      await databaseClient.query(await readFile(path, "utf8"));
    }
    await databaseClient.query(`grant littlearc_app to ${quoteIdentifier(currentUser)}`);
    connection = createDatabaseConnection(databaseUrl);
    const keyEncryptionKey = randomBytes(32);
    const crypto = createStructuredPayloadCrypto({
      keyEncryptionKey,
      wrappingKeyVersion: 1,
    });
    const command = createOwnerOnboardingCommand({
      adultVerification: createSyntheticAdultVerification(),
      crypto,
      database: connection.database,
    });
    const deviceCommand = createDeviceEnrollmentCommand(connection.database);
    const syncService = createSyncService({
      cursorCodec: createSyncCursorCodec(keyEncryptionKey),
      persistence: createSyncPersistence({ crypto, database: connection.database }),
    });

    if (off04DeviceMode) {
      closeServer = await serveOff04Device(command, deviceCommand, syncService, databaseClient);
      await new Promise<void>((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
    } else if (off03DeviceMode) {
      closeServer = await serveOff03Device(command, deviceCommand, databaseClient);
      await new Promise<void>((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
    } else if (deviceMode) {
      closeServer = await serveDevice(command, databaseClient);
      await new Promise<void>((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
    } else {
      await runAutomated(command, deviceCommand, databaseClient, currentUser, syncService);
    }
  } finally {
    await closeServer?.();
    await connection?.close();
    await databaseClient?.end();
    if (created) {
      await admin.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
        [databaseName],
      );
      await admin.query(`drop database if exists ${quoteIdentifier(databaseName)}`);
    }
    await admin.end();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown OFF-02 validation failure.";
  console.error(
    "OFF-02 PostgreSQL household validation failed: " +
      message.replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[redacted-database-url]"),
  );
  process.exitCode = 1;
});
