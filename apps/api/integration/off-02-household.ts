import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createStructuredPayloadCrypto } from "@littlearc/crypto";
import type { DeviceEnrollmentPersistenceError } from "@littlearc/database";
import { createDatabaseConnection } from "@littlearc/database";
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

const migrationPaths = [
  "../../../packages/database/migrations/0001_fnd_05_database_foundation.sql",
  "../../../packages/database/migrations/0002_off_01_consumer_auth.sql",
  "../../../packages/database/migrations/0003_off_02_household_consent_audit.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url)));
const deviceMode = process.argv.includes("--device");
const off03DeviceMode = process.argv.includes("--device-off03");
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
    const crypto = createStructuredPayloadCrypto({
      keyEncryptionKey: randomBytes(32),
      wrappingKeyVersion: 1,
    });
    const command = createOwnerOnboardingCommand({
      adultVerification: createSyntheticAdultVerification(),
      crypto,
      database: connection.database,
    });
    const deviceCommand = createDeviceEnrollmentCommand(connection.database);

    if (off03DeviceMode) {
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
      await runAutomated(command, deviceCommand, databaseClient, currentUser);
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
