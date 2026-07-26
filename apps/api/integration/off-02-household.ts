import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import rateLimit from "@fastify/rate-limit";
import {
  createFileKeyCrypto,
  createStructuredPayloadCrypto,
  type StructuredPayloadCrypto,
  type WrappedHouseholdKey,
} from "@littlearc/crypto";
import type { DeviceEnrollmentPersistenceError } from "@littlearc/database";
import {
  createDatabaseConnection,
  createFilePreviewGrantPersistence,
  createFilePreviewPersistence,
  createFileUploadPersistence,
  createSyncCursorCodec,
  createSyncPersistence,
  createUploadCleanupPersistence,
} from "@littlearc/database";
import type {
  EmergencyCardContent,
  RecordCategory,
  RecordVersionContentV1,
  UuidV7,
} from "@littlearc/domain";
import {
  createMemoryEncryptedObjectStorage,
  type EncryptedObjectStorage,
} from "@littlearc/storage";
import { Client } from "pg";
import { loadApiConfig } from "../src/config.js";
import { createDeviceEnrollmentCommand } from "../src/device-enrollment.js";
import type { DeviceEnrollmentCommand } from "../src/device-enrollment-route.js";
import { createFileUploadService } from "../src/file-upload.js";
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
  "../../../packages/database/migrations/0004_off_05_emergency_card.sql",
  "../../../packages/database/migrations/0005_vlt_01_record_foundation.sql",
  "../../../packages/database/migrations/0006_vlt_04_file_upload.sql",
  "../../../packages/database/migrations/0007_vlt_05_file_validation.sql",
  "../../../packages/database/migrations/0008_vlt_05_f3_file_previews.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url)));
const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const deviceMode = process.argv.includes("--device");
const off03DeviceMode = process.argv.includes("--device-off03");
const off04DeviceMode = process.argv.includes("--device-off04");
const off05DeviceMode = process.argv.includes("--device-off05");
const off06DeviceMode = process.argv.includes("--device-off06");
const vlt01DeviceMode = process.argv.includes("--device-vlt01");
const vlt04DeviceMode = process.argv.includes("--device-vlt04");
const deviceApiPort = Number(process.env.LITTLEARC_DEVICE_API_PORT ?? "3000");
const syntheticRequest: OwnerOnboardingRequest = {
  adultVerificationAssertion: "synthetic-approved-off-02",
  child: { dateOfBirth: "2020-01-01", preferredName: "Synthetic Child" },
  childDataConsentVersion: "child-data-processing-v1",
  countryCode: "IN",
  parent: { displayName: "Synthetic Parent", relationship: "parent" },
  parentNoticeVersion: "parent-notice-v1",
  timeZone: "Asia/Kolkata",
};

const syntheticEmergencyContent: EmergencyCardContent = {
  allergies: { state: "noneConfirmed" },
  bloodGroup: { state: "confirmed", value: "O+" },
  criticalNotes: { state: "confirmed", values: ["Synthetic critical note"] },
  dateOfBirth: "2020-01-01",
  guardianContacts: [
    { name: "Synthetic Guardian", phone: "+919999999999", relationship: "Parent" },
  ],
  pediatrician: {
    name: "Synthetic Pediatrician",
    phone: "+918888888888",
    state: "confirmed",
  },
  preferredName: "Synthetic Child",
  urgentMedications: { state: "noneConfirmed" },
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
  crypto: StructuredPayloadCrypto,
  database: ReturnType<typeof createDatabaseConnection>["database"],
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

  const fileDeviceId = nextId();
  await deviceCommand.execute({
    identityUserId: firstUser,
    request: {
      appVersion: "0.0.1",
      deviceId: fileDeviceId,
      localSchemaVersion: 8,
      platform: "android",
    },
    requestId: nextId(),
  });
  await runFileUploadAutomated(database, client, crypto, {
    childId: first.childId,
    deviceId: fileDeviceId,
    firstUser,
    secondUser,
  });

  await runSyncAutomated(syncService, client, {
    firstChildId: first.childId,
    firstHouseholdId: first.householdId,
    firstUser,
    secondUser,
  });
  await runEmergencyCardAutomated(syncService, client, {
    firstChildId: first.childId,
    firstHouseholdId: first.householdId,
    firstUser,
    secondUser,
  });
  await runRecordAutomated(syncService, client, crypto, {
    firstChildId: first.childId,
    firstHouseholdId: first.householdId,
    firstMembershipId: first.membershipId,
    firstUser,
    secondUser,
  });
}

async function runFileUploadAutomated(
  database: ReturnType<typeof createDatabaseConnection>["database"],
  client: Client,
  crypto: StructuredPayloadCrypto,
  input: {
    readonly childId: UuidV7;
    readonly deviceId: UuidV7;
    readonly firstUser: string;
    readonly secondUser: string;
  },
): Promise<void> {
  const storage = createMemoryEncryptedObjectStorage();
  const persistence = createFileUploadPersistence({
    crypto,
    database,
    fileKeyCrypto: createFileKeyCrypto({ currentKeyVersion: 1 }),
  });
  const service = createFileUploadService({ enabled: true, persistence, storage });
  const ciphertext = Buffer.from("VLT04_SYNTHETIC_CIPHERTEXT_ONLY");
  const fileKey = randomBytes(32);
  const fileObjectId = nextId();
  const sessionId = nextId();
  const digest = createHash("sha256").update(ciphertext).digest("hex");
  const createRequest = {
    aadVersion: 1 as const,
    authTag: randomBytes(16).toString("base64"),
    captureAssetId: nextId(),
    childId: input.childId,
    ciphertextBytes: ciphertext.length,
    ciphertextSha256: digest,
    contentNonce: randomBytes(12).toString("base64"),
    declaredMime: "application/pdf" as const,
    deviceId: input.deviceId,
    encodedFileKey: fileKey.toString("base64"),
    fileObjectId,
    uploadSessionId: sessionId,
  };
  const createResults = await Promise.all([
    service.create({
      identityUserId: input.firstUser,
      request: createRequest,
      requestId: nextId(),
    }),
    service.create({
      identityUserId: input.firstUser,
      request: createRequest,
      requestId: nextId(),
    }),
  ]);
  assert(
    createResults.filter((result) => result.replayed).length === 1 &&
      createResults.filter((result) => !result.replayed).length === 1,
    "VLT-04 concurrent exact replay was not idempotent.",
  );
  let conflictCode: string | undefined;
  try {
    await service.create({
      identityUserId: input.firstUser,
      request: {
        ...createRequest,
        ciphertextSha256: "f".repeat(64),
      },
      requestId: nextId(),
    });
  } catch (error) {
    conflictCode = persistenceCode(error);
  }
  assert(conflictCode === "invalid_state", "VLT-04 changed replay did not fail closed.");
  conflictCode = undefined;
  try {
    await service.create({
      identityUserId: input.firstUser,
      request: {
        ...createRequest,
        encodedFileKey: randomBytes(32).toString("base64"),
      },
      requestId: nextId(),
    });
  } catch (error) {
    conflictCode = persistenceCode(error);
  }
  assert(conflictCode === "invalid_state", "VLT-04 changed-key replay did not fail closed.");
  const internal = await persistence.readSession({
    identityUserId: input.firstUser,
    sessionId,
  });
  assert(internal, "VLT-04 upload session was not persisted.");
  const part = await storage.putPart({
    bytes: ciphertext,
    objectKey: internal.objectKey,
    partNumber: 1,
    providerUploadId: internal.providerUploadId,
  });
  await service.reconcile({ identityUserId: input.firstUser, sessionId });
  const completed = await service.complete({
    identityUserId: input.firstUser,
    request: { parts: [part] },
    requestId: nextId(),
    sessionId,
  });
  assert(
    completed.uploadState === "uploaded" && completed.validationState === "pending",
    "VLT-04 completion claimed an invalid state.",
  );
  const download = await service.download({
    deviceId: input.deviceId,
    fileObjectId,
    identityUserId: input.firstUser,
    requestId: nextId(),
  });
  assert(
    download.ciphertextSha256 === digest &&
      download.encodedFileKey === fileKey.toString("base64") &&
      Buffer.from(storage.readObject(internal.objectKey) ?? []).equals(ciphertext),
    "VLT-04 encrypted download material did not match the verified upload.",
  );

  let crossHouseholdCode: string | undefined;
  try {
    await service.read({ identityUserId: input.secondUser, sessionId });
  } catch (error) {
    crossHouseholdCode =
      error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
  }
  assert(crossHouseholdCode === "not_found", "Cross-household upload lookup did not fail closed.");

  await verifyFileValidationPersistence(client, service, {
    fileObjectId,
    firstUser: input.firstUser,
    secondUser: input.secondUser,
  });
  await verifyFilePreviewPersistence(database, client, crypto, persistence, storage, {
    deviceId: input.deviceId,
    fileObjectId,
    firstUser: input.firstUser,
    secondUser: input.secondUser,
  });

  await client.query(
    "update littlearc.devices set enrollment_status = 'revoked', revoked_at = now() where id = $1",
    [input.deviceId],
  );
  let revokedCode: string | undefined;
  try {
    await service.download({
      deviceId: input.deviceId,
      fileObjectId,
      identityUserId: input.firstUser,
      requestId: nextId(),
    });
  } catch (error) {
    revokedCode = persistenceCode(error);
  }
  assert(revokedCode === "device_required", "A revoked device received download authority.");
  await client.query(
    "update littlearc.devices set enrollment_status = 'active', revoked_at = null where id = $1",
    [input.deviceId],
  );

  const evidence = await client.query<{
    readonly completed: string;
    readonly created: string;
    readonly downloaded: string;
    readonly files: string;
  }>(
    `select
       (select count(*)::text from littlearc.file_objects where id = $1) files,
       (select count(*)::text from littlearc.audit_events
         where target_id = $2 and action = 'file_upload_created') created,
       (select count(*)::text from littlearc.audit_events
         where target_id = $1 and action = 'file_upload_completed') completed,
       (select count(*)::text from littlearc.audit_events
         where target_id = $1 and action = 'file_download_authorized') downloaded`,
    [fileObjectId, sessionId],
  );
  assert(
    evidence.rows[0]?.files === "1" &&
      evidence.rows[0].created === "1" &&
      evidence.rows[0].completed === "1" &&
      evidence.rows[0].downloaded === "1",
    "VLT-04 file-object or audit evidence is incomplete.",
  );
  fileKey.fill(0);
  console.log("VLT-04 PostgreSQL encrypted upload validation passed.");
  console.log(
    "- Exact replay, changed-metadata/key rejection, multipart resume facts, full digest verification, and pending validation passed.",
  );
  console.log("- Cross-household lookup and revoked-device download failed closed.");
  console.log("- PostgreSQL retained wrapped key material and ciphertext metadata only.");

  const cleanupSessionId = nextId();
  const cleanupFileObjectId = nextId();
  await service.create({
    identityUserId: input.firstUser,
    request: {
      aadVersion: 1,
      authTag: randomBytes(16).toString("base64"),
      captureAssetId: nextId(),
      childId: input.childId,
      ciphertextBytes: ciphertext.length,
      ciphertextSha256: digest,
      contentNonce: randomBytes(12).toString("base64"),
      declaredMime: "application/pdf",
      deviceId: input.deviceId,
      encodedFileKey: randomBytes(32).toString("base64"),
      fileObjectId: cleanupFileObjectId,
      uploadSessionId: cleanupSessionId,
    },
    requestId: nextId(),
  });
  await client.query(
    "update littlearc.upload_sessions set expires_at = now() - interval '1 minute' where id = $1",
    [cleanupSessionId],
  );
  const cleanup = createUploadCleanupPersistence(database);
  const claims = await cleanup.claim(20);
  const claim = claims.find((item) => item.sessionId === cleanupSessionId);
  assert(claim, "The least-authority worker did not claim the expired multipart session.");
  await storage.abortMultipart({
    objectKey: claim.objectKey,
    providerUploadId: claim.providerUploadId,
  });
  await cleanup.finish(cleanupSessionId, true);
  const expired = await client.query<{ readonly status: string }>(
    "select status from littlearc.upload_sessions where id = $1",
    [cleanupSessionId],
  );
  assert(expired.rows[0]?.status === "expired", "Worker cleanup did not record terminal expiry.");
  console.log(
    "- Least-authority worker expiry claim, provider abort, and terminal cleanup passed.",
  );
}

async function verifyFileValidationPersistence(
  client: Client,
  service: ReturnType<typeof createFileUploadService>,
  input: {
    readonly fileObjectId: UuidV7;
    readonly firstUser: string;
    readonly secondUser: string;
  },
): Promise<void> {
  const attemptId = nextId();
  const eventShape = await client.query<{ readonly payload: unknown }>(
    `select payload
       from littlearc.outbox_events
      where aggregate_id = $1 and event_type = 'file_validation_requested'`,
    [input.fileObjectId],
  );
  assert(
    JSON.stringify(eventShape.rows[0]?.payload) ===
      JSON.stringify({ fileObjectId: input.fileObjectId }),
    "VLT-05 outbox payload was not the exact minimized shape.",
  );
  await client.query("begin");
  try {
    await client.query("set local role littlearc_worker");
    await client.query("savepoint direct_worker_read");
    let directReadCode: string | undefined;
    try {
      await client.query("select id from littlearc.file_objects where id = $1", [
        input.fileObjectId,
      ]);
    } catch (error) {
      directReadCode = persistenceCode(error);
      await client.query("rollback to savepoint direct_worker_read");
    }
    assert(directReadCode === "42501", "Worker direct file-object reads were not denied.");

    const dispatch = await client.query<{
      readonly eventId: string;
      readonly fileObjectId: string;
    }>(
      `select event_id::text "eventId", file_object_id::text "fileObjectId"
         from littlearc.claim_file_validation_outbox(10)`,
    );
    assert(dispatch.rowCount === 1, "VLT-05 minimized outbox dispatch was not claimable.");
    assert(
      dispatch.rows[0]?.fileObjectId === input.fileObjectId,
      "VLT-05 dispatch returned an unexpected file object.",
    );
    await client.query("select littlearc.finish_file_validation_outbox($1, true)", [
      dispatch.rows[0]?.eventId,
    ]);

    const claim = await client.query<Record<string, unknown>>(
      "select * from littlearc.claim_file_validation($1, $2, 900)",
      [input.fileObjectId, attemptId],
    );
    assert(claim.rowCount === 1, "VLT-05 validation claim was not acquired.");
    const serializedKeys = Object.keys(claim.rows[0] ?? {}).join(",");
    for (const prohibited of ["child", "filename", "record", "membership"]) {
      assert(
        !serializedKeys.includes(prohibited),
        `VLT-05 claim exposed prohibited ${prohibited} material.`,
      );
    }
    const premature = await client.query<{ readonly committed: boolean }>(
      "select littlearc.commit_file_validation_result($1, $2, 'rejected') committed",
      [input.fileObjectId, attemptId],
    );
    assert(
      !premature.rows[0]?.committed,
      "Validating state bypassed the result proposal boundary.",
    );
    const proposed = await client.query<{ readonly proposed: boolean }>(
      `select littlearc.propose_file_validation_result(
         $1, $2, 'rejected', 'pending', null, null, 'type_mismatch', 1
       ) proposed`,
      [input.fileObjectId, attemptId],
    );
    assert(proposed.rows[0]?.proposed, "VLT-05 rejection proposal was not persisted.");
    const committed = await client.query<{ readonly committed: boolean }>(
      "select littlearc.commit_file_validation_result($1, $2, 'rejected') committed",
      [input.fileObjectId, attemptId],
    );
    assert(committed.rows[0]?.committed, "VLT-05 cleanup-gated rejection was not committed.");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const status = await service.readStatus({
    fileObjectId: input.fileObjectId,
    identityUserId: input.firstUser,
  });
  assert(
    status.validationState === "rejected" &&
      status.previewState === "not_authorized" &&
      status.safeErrorCode === "type_mismatch",
    "VLT-05 safe status projection was incomplete.",
  );
  let crossHouseholdCode: string | undefined;
  try {
    await service.readStatus({
      fileObjectId: input.fileObjectId,
      identityUserId: input.secondUser,
    });
  } catch (error) {
    crossHouseholdCode = persistenceCode(error);
  }
  assert(crossHouseholdCode === "not_found", "Cross-household VLT-05 status did not fail closed.");

  const exhaustedAttemptId = nextId();
  await client.query(
    `update littlearc.file_objects
        set validation_state = 'queued',
            validation_attempt_id = null,
            validation_lease_expires_at = null,
            validation_safe_error_code = null,
            validation_completed_at = null
      where id = $1`,
    [input.fileObjectId],
  );
  await client.query("begin");
  try {
    await client.query("set local role littlearc_worker");
    const exhaustedClaim = await client.query(
      "select * from littlearc.claim_file_validation($1, $2, 900)",
      [input.fileObjectId, exhaustedAttemptId],
    );
    assert(exhaustedClaim.rowCount === 1, "Retry-exhaustion claim was not acquired.");
    const retried = await client.query<{ readonly retried: boolean }>(
      "select littlearc.retry_file_validation($1, $2, 'scanner_unavailable') retried",
      [input.fileObjectId, exhaustedAttemptId],
    );
    assert(retried.rows[0]?.retried, "Retryable failure did not return to queued.");
    const exhausted = await client.query<{ readonly failed: boolean }>(
      "select littlearc.fail_exhausted_file_validation($1) failed",
      [input.fileObjectId],
    );
    assert(exhausted.rows[0]?.failed, "Exhausted retries did not enter terminal failed.");
    const replay = await client.query<{ readonly failed: boolean }>(
      "select littlearc.fail_exhausted_file_validation($1) failed",
      [input.fileObjectId],
    );
    assert(!replay.rows[0]?.failed, "Retry exhaustion was not idempotent.");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  const failedStatus = await service.readStatus({
    fileObjectId: input.fileObjectId,
    identityUserId: input.firstUser,
  });
  assert(
    failedStatus.validationState === "failed" &&
      failedStatus.safeErrorCode === "validation_retry_exhausted",
    "Retry exhaustion did not expose the bounded safe state.",
  );
  console.log("VLT-05 PostgreSQL dispatch, least-authority claim, and safe status passed.");
}

async function verifyFilePreviewPersistence(
  database: ReturnType<typeof createDatabaseConnection>["database"],
  client: Client,
  crypto: StructuredPayloadCrypto,
  filePersistence: ReturnType<typeof createFileUploadPersistence>,
  storage: ReturnType<typeof createMemoryEncryptedObjectStorage>,
  input: {
    readonly deviceId: UuidV7;
    readonly fileObjectId: UuidV7;
    readonly firstUser: string;
    readonly secondUser: string;
  },
): Promise<void> {
  await client.query(
    `update littlearc.file_objects
       set validation_state = 'ready', malware_state = 'clean',
           detected_mime = 'image/jpeg', validation_safe_error_code = null,
           preview_state = 'not_authorized', deleted_at = null
     where id = $1`,
    [input.fileObjectId],
  );
  const derivativeId = nextId();
  const duplicateId = nextId();
  const attemptId = nextId();
  const previewPersistence = createFilePreviewPersistence(database);

  await client.query("begin");
  try {
    await client.query("set local role littlearc_worker");
    const eligible = await client.query<{ readonly sourceId: string }>(
      `select source_file_object_id::text "sourceId"
         from littlearc.list_eligible_file_preview_sources(20)`,
    );
    assert(
      eligible.rows.some((row) => row.sourceId === input.fileObjectId),
      "VLT-05-F3 ready/clean source was not eligible.",
    );
    const ensured = await client.query<{ readonly derivativeId: string }>(
      `select littlearc.ensure_file_preview_candidate($1, $2)::text "derivativeId"`,
      [input.fileObjectId, derivativeId],
    );
    const duplicate = await client.query<{ readonly derivativeId: string }>(
      `select littlearc.ensure_file_preview_candidate($1, $2)::text "derivativeId"`,
      [input.fileObjectId, duplicateId],
    );
    assert(
      ensured.rows[0]?.derivativeId === derivativeId &&
        duplicate.rows[0]?.derivativeId === derivativeId,
      "VLT-05-F3 duplicate candidate creation did not converge.",
    );
    await client.query("savepoint direct_derivative_read");
    let directReadCode: string | undefined;
    try {
      await client.query("select id from littlearc.file_derivatives where id = $1", [derivativeId]);
    } catch (error) {
      directReadCode = persistenceCode(error);
      await client.query("rollback to savepoint direct_derivative_read");
    }
    assert(directReadCode === "42501", "Worker direct derivative reads were not denied.");
    const dispatch = await client.query<{
      readonly derivativeId: string;
      readonly eventId: string;
    }>(
      `select event_id::text "eventId", derivative_id::text "derivativeId"
         from littlearc.claim_file_preview_outbox(20)`,
    );
    assert(
      dispatch.rows.some((row) => row.derivativeId === derivativeId),
      "VLT-05-F3 minimized preview dispatch was not claimable.",
    );
    const claimedDispatch = dispatch.rows.find((row) => row.derivativeId === derivativeId);
    assert(claimedDispatch, "VLT-05-F3 preview dispatch claim disappeared.");
    await client.query("select littlearc.finish_file_preview_outbox($1, true)", [
      claimedDispatch.eventId,
    ]);
    const claim = await client.query<Record<string, unknown>>(
      "select * from littlearc.claim_file_preview($1, $2, 900)",
      [derivativeId, attemptId],
    );
    assert(claim.rowCount === 1, "VLT-05-F3 derivative lease was not acquired.");
    const claimKeys = Object.keys(claim.rows[0] ?? {}).join(",");
    for (const prohibited of ["child", "filename", "record", "membership"]) {
      assert(!claimKeys.includes(prohibited), `VLT-05-F3 claim exposed ${prohibited}.`);
    }
    const premature = await client.query<{ readonly committed: boolean }>(
      "select littlearc.commit_file_preview_result($1, $2) committed",
      [derivativeId, attemptId],
    );
    assert(!premature.rows[0]?.committed, "VLT-05-F3 bypassed cleanup-gated proposal.");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const householdKeyRow = await client.query<WrappedHouseholdKey>(
    `select key_version as "keyVersion", wrap_nonce as "wrapNonce",
       wrapped_key as "wrappedKey", wrapping_key_version as "wrappingKeyVersion"
     from littlearc.household_keys
     where household_id = (
       select household_id from littlearc.file_objects where id = $1
     ) and status = 'active'
     order by key_version desc limit 1`,
    [input.fileObjectId],
  );
  const wrappedHouseholdKey = householdKeyRow.rows[0];
  assert(wrappedHouseholdKey, "VLT-05-F3 household key was unavailable.");
  const householdKey = crypto.unwrapHouseholdKey(wrappedHouseholdKey);
  const derivativeKey = randomBytes(32);
  const fileKeyCrypto = createFileKeyCrypto({ currentKeyVersion: 1 });
  const context = {
    aadSchemaVersion: 1,
    derivativeId,
    format: "image/jpeg",
    previewPolicyVersion: 1,
    purpose: "validation-preview",
    sourceObjectId: input.fileObjectId,
  } as const;
  const wrappedDerivativeKey = fileKeyCrypto.wrap(derivativeKey, householdKey, context);
  householdKey.fill(0);
  const ciphertext = randomBytes(256);
  const digest = createHash("sha256").update(ciphertext).digest("hex");
  const objectKey = `derivatives/${derivativeId}/${attemptId}.lac`;
  const { providerUploadId } = await storage.initiateMultipart(objectKey);
  const part = await storage.putPart({
    bytes: ciphertext,
    objectKey,
    partNumber: 1,
    providerUploadId,
  });
  await storage.completeMultipart({ objectKey, parts: [part], providerUploadId });

  const proposed = await previewPersistence.propose(derivativeId, attemptId, {
    authTag: randomBytes(16),
    ciphertextBytes: ciphertext.length,
    ciphertextSha256: digest,
    contentNonce: randomBytes(12),
    keyVersion: wrappedDerivativeKey.keyVersion,
    pixelHeight: 600,
    pixelWidth: 800,
    storageKey: objectKey,
    wrappedFileKey: wrappedDerivativeKey.wrappedKey,
    wrapNonce: wrappedDerivativeKey.wrapNonce,
  });
  assert(proposed, "VLT-05-F3 encrypted derivative proposal was not persisted.");
  const preCleanup = await client.query<{ readonly state: string }>(
    "select state from littlearc.file_derivatives where id = $1",
    [derivativeId],
  );
  assert(
    preCleanup.rows[0]?.state === "result_pending_cleanup",
    "VLT-05-F3 proposal skipped the cleanup gate.",
  );
  assert(
    await previewPersistence.commit(derivativeId, attemptId),
    "VLT-05-F3 cleanup-gated commit failed.",
  );

  const previewGrantPersistence = createFilePreviewGrantPersistence({
    crypto,
    database,
    fileKeyCrypto,
  });
  const service = createFileUploadService({
    enabled: true,
    persistence: filePersistence,
    previewPersistence: previewGrantPersistence,
    storage,
  });
  const grant = await service.preview({
    deviceId: input.deviceId,
    fileObjectId: input.fileObjectId,
    identityUserId: input.firstUser,
    requestId: nextId(),
  });
  assert(
    grant.derivativeId === derivativeId &&
      grant.previewPolicyVersion === 1 &&
      grant.ciphertextSha256 === digest &&
      grant.encodedFileKey === derivativeKey.toString("base64") &&
      !JSON.stringify(grant).includes("plaintext"),
    "VLT-05-F3 encrypted preview grant was incomplete.",
  );
  let crossHouseholdCode: string | undefined;
  try {
    await service.preview({
      deviceId: input.deviceId,
      fileObjectId: input.fileObjectId,
      identityUserId: input.secondUser,
      requestId: nextId(),
    });
  } catch (error) {
    crossHouseholdCode = persistenceCode(error);
  }
  assert(
    crossHouseholdCode === "device_required" || crossHouseholdCode === "not_found",
    "Cross-household VLT-05-F3 grant did not fail closed.",
  );
  await client.query("update littlearc.file_objects set deleted_at = now() where id = $1", [
    input.fileObjectId,
  ]);
  let deletedCode: string | undefined;
  try {
    await service.preview({
      deviceId: input.deviceId,
      fileObjectId: input.fileObjectId,
      identityUserId: input.firstUser,
      requestId: nextId(),
    });
  } catch (error) {
    deletedCode = persistenceCode(error);
  }
  assert(deletedCode === "not_found", "Deleted source retained preview grant authority.");
  await client.query(
    `update littlearc.file_objects
       set deleted_at = null, validation_state = 'ready', preview_state = 'ready'
     where id = $1`,
    [input.fileObjectId],
  );

  const retryAttemptId = nextId();
  await client.query(
    `update littlearc.file_derivatives
       set state = 'queued', attempt_id = null, lease_expires_at = null,
           storage_key = null, ciphertext_bytes = null, ciphertext_sha256 = null,
           wrapped_file_key = null, wrap_nonce = null, content_nonce = null,
           auth_tag = null, key_version = null, detected_mime = null,
           pixel_width = null, pixel_height = null, completed_at = null
     where id = $1`,
    [derivativeId],
  );
  assert(
    await previewPersistence.claim(derivativeId, retryAttemptId, 900),
    "VLT-05-F3 retry claim was not acquired.",
  );
  assert(
    await previewPersistence.retry(derivativeId, retryAttemptId, "scanner_unavailable"),
    "VLT-05-F3 retryable failure did not requeue.",
  );
  assert(
    await previewPersistence.failExhausted(derivativeId),
    "VLT-05-F3 retry exhaustion did not become terminal.",
  );
  const original = await client.query<{
    readonly previewState: string;
    readonly validationState: string;
  }>(
    `select validation_state as "validationState", preview_state as "previewState"
       from littlearc.file_objects where id = $1`,
    [input.fileObjectId],
  );
  assert(
    original.rows[0]?.validationState === "ready" && original.rows[0]?.previewState === "failed",
    "VLT-05-F3 preview failure changed original readiness.",
  );
  const operational = JSON.stringify(
    await client.query(
      `select kind, policy_version, state, attempt_count, safe_error_code
         from littlearc.file_derivatives where id = $1`,
      [derivativeId],
    ),
  );
  for (const canary of ["filename", "Synthetic Child", "plaintext", "PREVIEW_CANARY"]) {
    assert(!operational.includes(canary), "VLT-05-F3 operational state leaked a canary.");
  }
  derivativeKey.fill(0);
  await storage.deleteObject(objectKey);
  console.log(
    "VLT-05-F3 PostgreSQL candidate, minimized dispatch, lease, cleanup gate, grant, RLS/BOLA, deletion, retry exhaustion, and original-readiness isolation passed.",
  );
}

async function prepareAndVerifyFileValidationQueue(
  client: Client,
  databaseUrl: string,
): Promise<void> {
  await execFileAsync("pnpm", ["--filter", "@littlearc/worker", "prepare:file-validation-queue"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      APP_ENV: "local",
      DATABASE_MIGRATION_URL: databaseUrl,
      DATABASE_URL: databaseUrl,
    },
    maxBuffer: 1024 * 1024,
    timeout: 120_000,
  });
  const schema = await client.query<{ readonly version: number }>(
    "select version from pgboss.version",
  );
  assert(schema.rows[0]?.version === 37, "Reviewed pg-boss schema version 37 was not prepared.");
  const queues = await client.query<{ readonly name: string }>(
    "select name from pgboss.queue where name in ('file-validation-v1', 'file-validation-dead-v1', 'file-preview-v1', 'file-preview-dead-v1') order by name",
  );
  assert(queues.rowCount === 4, "Required VLT-05 validation and preview queues were not prepared.");
  await client.query("begin");
  try {
    await client.query("set local role littlearc_worker");
    const runtimeRead = await client.query(
      "select name from pgboss.queue where name in ('file-validation-v1', 'file-validation-dead-v1', 'file-preview-v1', 'file-preview-dead-v1')",
    );
    assert(runtimeRead.rowCount === 4, "Worker runtime could not read prepared queues.");
    await client.query("savepoint schema_create");
    let createCode: string | undefined;
    try {
      await client.query("create table pgboss.worker_forbidden(id integer)");
    } catch (error) {
      createCode = persistenceCode(error);
      await client.query("rollback to savepoint schema_create");
    }
    assert(createCode === "42501", "Worker runtime retained pg-boss schema DDL authority.");
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  console.log("VLT-05 reviewed pg-boss schema and runtime least authority passed.");
}

const syntheticRecordContent: RecordVersionContentV1 = {
  details: {
    documentKind: { state: "confirmed", value: "Synthetic discharge summary" },
    schema: "document.v1",
  },
  notes: {
    state: "confirmed",
    value: "VLT01_CANARY_SYNTHETIC_NOTE",
  },
  providerFacility: {
    state: "confirmed",
    value: "VLT01_CANARY_SYNTHETIC_CLINIC",
  },
  schemaVersion: 1,
  title: "VLT01_CANARY_SYNTHETIC_RECORD",
};

const syntheticManualCategoryRecords: ReadonlyArray<{
  readonly category: Extract<
    RecordCategory,
    "document" | "vaccination" | "doctor_visit" | "prescription"
  >;
  readonly content: RecordVersionContentV1;
  readonly eventAt: string | null;
}> = [
  {
    category: "document",
    content: syntheticRecordContent,
    eventAt: null,
  },
  {
    category: "vaccination",
    content: {
      details: {
        batchLot: { state: "confirmed", value: "VLT02_CANARY_SYNTHETIC_LOT" },
        dateMeaning: { state: "confirmed", value: "given" },
        schema: "vaccination.v1",
        vaccineName: "VLT02_CANARY_SYNTHETIC_VACCINE",
      },
      notes: { state: "notProvided" },
      providerFacility: { state: "confirmed", value: "VLT02_CANARY_SYNTHETIC_CLINIC" },
      schemaVersion: 1,
      title: "VLT02_CANARY_SYNTHETIC_VACCINATION",
    },
    eventAt: "2026-07-20T00:00:00.000Z",
  },
  {
    category: "doctor_visit",
    content: {
      details: {
        followUpDate: { state: "confirmed", value: "2026-08-01" },
        reasonForVisit: "VLT02_CANARY_SYNTHETIC_VISIT_REASON",
        schema: "doctor_visit.v1",
        tags: { state: "confirmed", value: "VLT02_CANARY_SYNTHETIC_TAG" },
      },
      notes: { state: "confirmed", value: "VLT02_CANARY_SYNTHETIC_VISIT_NOTE" },
      providerFacility: { state: "confirmed", value: "VLT02_CANARY_SYNTHETIC_CLINIC" },
      schemaVersion: 1,
      title: "VLT02_CANARY_SYNTHETIC_VISIT",
    },
    eventAt: "2026-07-21T00:00:00.000Z",
  },
  {
    category: "prescription",
    content: {
      details: {
        duration: { state: "confirmed", value: "VLT02_CANARY_SYNTHETIC_DURATION" },
        endDate: { state: "confirmed", value: "2026-08-02" },
        medicines: "VLT02_CANARY_SYNTHETIC_MEDICINE",
        schema: "prescription.v1",
        writtenSchedule: {
          state: "confirmed",
          value: "VLT02_CANARY_SYNTHETIC_WRITTEN_SCHEDULE",
        },
      },
      notes: { state: "notProvided" },
      providerFacility: { state: "confirmed", value: "VLT02_CANARY_SYNTHETIC_CLINIC" },
      schemaVersion: 1,
      title: "VLT02_CANARY_SYNTHETIC_PRESCRIPTION",
    },
    eventAt: "2026-07-22T00:00:00.000Z",
  },
];

async function runRecordAutomated(
  syncService: SyncService,
  client: Client,
  crypto: StructuredPayloadCrypto,
  input: {
    readonly firstChildId: UuidV7;
    readonly firstHouseholdId: UuidV7;
    readonly firstMembershipId: UuidV7;
    readonly firstUser: string;
    readonly secondUser: string;
  },
): Promise<void> {
  const recordId = nextId();
  const createMutation = {
    baseRevision: null,
    entityId: recordId,
    entityType: "record" as const,
    idempotencyKey: nextId(),
    localDependencyIds: [],
    mutationId: nextId(),
    operation: "create" as const,
    payload: {
      category: "document" as const,
      childId: input.firstChildId,
      content: syntheticRecordContent,
      eventAt: null,
      sourceType: "manual" as const,
    },
  };
  const created = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [createMutation],
  });
  assert(created.results[0]?.status === "applied", "VLT-01 record create did not apply.");
  const replay = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [createMutation],
  });
  assert(replay.results[0]?.status === "duplicate", "VLT-01 exact replay was not duplicate.");
  const mismatch = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [
      {
        ...createMutation,
        payload: {
          ...createMutation.payload,
          content: { ...syntheticRecordContent, title: "Changed replay" },
        },
      },
    ],
  });
  assert(
    mismatch.results[0]?.status === "rejected" &&
      mismatch.results[0].reason === "idempotencyMismatch",
    "VLT-01 changed replay did not fail closed.",
  );

  const updateMutation = {
    ...createMutation,
    baseRevision: 1,
    idempotencyKey: nextId(),
    mutationId: nextId(),
    operation: "update" as const,
    payload: {
      ...createMutation.payload,
      content: {
        ...syntheticRecordContent,
        notes: {
          state: "confirmed" as const,
          value: "VLT01_CANARY_SYNTHETIC_CORRECTION",
        },
      },
      eventAt: "2026-07-20T09:30:00.000Z",
    },
  };
  const updated = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [updateMutation],
  });
  assert(updated.results[0]?.status === "applied", "VLT-01 correction did not apply.");
  const stale = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [
      {
        ...updateMutation,
        idempotencyKey: nextId(),
        mutationId: nextId(),
      },
    ],
  });
  assert(stale.results[0]?.status === "conflict", "VLT-01 stale correction did not conflict.");

  const current = await syncService.readRecord({
    identityUserId: input.firstUser,
    recordId,
  });
  assert(
    current?.revision === 2 &&
      current.version === 2 &&
      current.eventAt === "2026-07-20T09:30:00.000Z",
    "VLT-01 current projection is invalid.",
  );
  const history = await syncService.readRecordVersions({
    identityUserId: input.firstUser,
    limit: 20,
    recordId,
  });
  assert(
    history.length === 2 &&
      history[0]?.version === 2 &&
      history[1]?.version === 1 &&
      history[0].supersedesVersionId === history[1].versionId,
    "VLT-01 immutable version history is invalid.",
  );
  const crossHousehold = await syncService.readRecord({
    identityUserId: input.secondUser,
    recordId,
  });
  assert(crossHousehold === null, "Cross-household VLT-01 record was visible.");

  const manualRecordIds: UuidV7[] = [];
  for (const [index, manual] of syntheticManualCategoryRecords.entries()) {
    const manualRecordId = nextId();
    manualRecordIds.push(manualRecordId);
    const manualCreate = {
      baseRevision: null,
      entityId: manualRecordId,
      entityType: "record" as const,
      idempotencyKey: nextId(),
      localDependencyIds: [],
      mutationId: nextId(),
      operation: "create" as const,
      payload: {
        category: manual.category,
        childId: input.firstChildId,
        content: manual.content,
        eventAt: manual.eventAt,
        sourceType: "manual" as const,
      },
    };
    const manualCreated = await syncService.push({
      identityUserId: input.firstUser,
      mutations: [manualCreate],
    });
    assert(
      manualCreated.results[0]?.status === "applied",
      `VLT-02 ${manual.category} create did not apply.`,
    );
    const manualCorrected = await syncService.push({
      identityUserId: input.firstUser,
      mutations: [
        {
          ...manualCreate,
          baseRevision: 1,
          idempotencyKey: nextId(),
          mutationId: nextId(),
          operation: "update" as const,
          payload: {
            ...manualCreate.payload,
            content: {
              ...manual.content,
              title: `${manual.content.title} CORRECTED`,
            },
          },
        },
      ],
    });
    assert(
      manualCorrected.results[0]?.status === "applied",
      `VLT-02 ${manual.category} correction did not apply.`,
    );
    const [manualCurrent, manualHistory] = await Promise.all([
      syncService.readRecord({
        identityUserId: input.firstUser,
        recordId: manualRecordId,
      }),
      syncService.readRecordVersions({
        identityUserId: input.firstUser,
        limit: 20,
        recordId: manualRecordId,
      }),
    ]);
    assert(
      manualCurrent?.category === manual.category &&
        manualCurrent.provenance.sourceType === "manual" &&
        manualCurrent.provenance.trustedIssuer === false &&
        manualCurrent.revision === 2 &&
        manualCurrent.version === 2 &&
        manualHistory.length === 2,
      `VLT-02 ${manual.category} version/provenance evidence is invalid.`,
    );
    if (index === 0) {
      const manualDeleted = await syncService.push({
        identityUserId: input.firstUser,
        mutations: [
          {
            baseRevision: 2,
            entityId: manualRecordId,
            entityType: "record",
            idempotencyKey: nextId(),
            localDependencyIds: [],
            mutationId: nextId(),
            operation: "delete",
          },
        ],
      });
      assert(manualDeleted.results[0]?.status === "applied", "VLT-02 manual delete did not apply.");
    }
  }

  const wrapped = await client.query<WrappedHouseholdKey>(
    `select
       key_version as "keyVersion",
       wrap_nonce as "wrapNonce",
       wrapped_key as "wrappedKey",
       wrapping_key_version as "wrappingKeyVersion"
     from littlearc.household_keys
     where household_id = $1 and status = 'active'
     order by key_version desc limit 1`,
    [input.firstHouseholdId],
  );
  const householdKey = wrapped.rows[0];
  assert(householdKey, "VLT-01 household key was unavailable.");
  const plaintextKey = crypto.unwrapHouseholdKey(householdKey);
  const suggestionId = nextId();
  try {
    const encryptedSuggestion = crypto.encrypt(
      { value: "VLT01_CANARY_SYNTHETIC_SUGGESTION" },
      {
        aadSchemaVersion: 1,
        householdId: input.firstHouseholdId,
        objectId: suggestionId,
        objectType: "record_suggestion",
      },
      plaintextKey,
      householdKey.keyVersion,
    );
    const encryptedSourceSpan = crypto.encrypt(
      { value: "VLT01_CANARY_SYNTHETIC_SOURCE_SPAN" },
      {
        aadSchemaVersion: 1,
        householdId: input.firstHouseholdId,
        objectId: suggestionId,
        objectType: "record_suggestion",
      },
      plaintextKey,
      householdKey.keyVersion,
    );
    await client.query("begin");
    try {
      await client.query("set local role littlearc_app");
      await client.query(
        `select
          set_config('littlearc.current_household_id', $1, true),
          set_config('littlearc.current_actor_id', $2, true),
          set_config('littlearc.current_actor_role', 'owner', true),
          set_config('littlearc.current_identity_user_id', $3, true)`,
        [input.firstHouseholdId, input.firstMembershipId, input.firstUser],
      );
      await client.query(
        `insert into littlearc.record_suggestions (
           id, household_id, record_id, record_version_id, field_path,
           encrypted_suggestion, encrypted_source_span, confidence_bucket,
           extractor_type, review_state, expires_at
         ) values ($1, $2, $3, $4, 'details.documentKind', $5::jsonb, $6::jsonb,
           'medium', 'local_ocr', 'pending', now() + interval '1 day')`,
        [
          suggestionId,
          input.firstHouseholdId,
          recordId,
          history[0]?.versionId,
          JSON.stringify(encryptedSuggestion),
          JSON.stringify(encryptedSourceSpan),
        ],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    plaintextKey.fill(0);
  }
  const suggestionAuthority = await client.query<{
    readonly activeTimeline: string;
    readonly suggestions: string;
    readonly versions: string;
  }>(
    `select
       (select count(*)::text from littlearc.record_suggestions
         where record_id = $1 and review_state = 'pending') suggestions,
       (select count(*)::text from littlearc.record_versions
         where record_id = $1) versions,
       (select count(*)::text from littlearc.timeline_entries
         where source_record_id = $1 and projection_state = 'active') "activeTimeline"`,
    [recordId],
  );
  assert(
    suggestionAuthority.rows[0]?.suggestions === "1" &&
      suggestionAuthority.rows[0].versions === "2" &&
      suggestionAuthority.rows[0].activeTimeline === "1",
    "VLT-01 suggestion changed confirmed or Timeline authority.",
  );

  let immutableCode: string | undefined;
  await client.query("begin");
  try {
    await client.query("set local role littlearc_app");
    await client.query(
      `select
        set_config('littlearc.current_household_id', $1, true),
        set_config('littlearc.current_actor_id', $2, true),
        set_config('littlearc.current_actor_role', 'owner', true),
        set_config('littlearc.current_identity_user_id', $3, true)`,
      [input.firstHouseholdId, input.firstMembershipId, input.firstUser],
    );
    await client.query(
      "update littlearc.record_versions set version_number = 9 where record_id = $1",
      [recordId],
    );
  } catch (error) {
    immutableCode =
      error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
  } finally {
    await client.query("rollback");
  }
  assert(immutableCode === "42501", "VLT-01 immutable version accepted an update.");

  const rollbackRecordId = nextId();
  await client.query(`
    create function littlearc.vlt01_force_rollback() returns trigger language plpgsql as $$
    begin
      raise exception 'synthetic VLT-01 forced rollback';
    end $$;
    create trigger vlt01_force_rollback before insert on littlearc.outbox_events
    for each row execute function littlearc.vlt01_force_rollback();
  `);
  try {
    await syncService.push({
      identityUserId: input.firstUser,
      mutations: [
        {
          ...createMutation,
          entityId: rollbackRecordId,
          idempotencyKey: nextId(),
          mutationId: nextId(),
        },
      ],
    });
    throw new Error("Forced VLT-01 rollback unexpectedly succeeded.");
  } catch (error) {
    assert(
      error instanceof Error &&
        (error.message.includes("synthetic VLT-01 forced rollback") ||
          error.message.includes("insert into littlearc.outbox_events")),
      "Forced VLT-01 rollback returned the wrong error: " +
        (error instanceof Error ? error.message : String(error)),
    );
  } finally {
    await client.query("drop trigger vlt01_force_rollback on littlearc.outbox_events");
    await client.query("drop function littlearc.vlt01_force_rollback()");
  }
  const rollbackCounts = await client.query<{ readonly count: string }>(
    `select (
       (select count(*) from littlearc.records where id = $1) +
       (select count(*) from littlearc.record_versions where record_id = $1) +
       (select count(*) from littlearc.timeline_entries where source_record_id = $1)
     )::text count`,
    [rollbackRecordId],
  );
  assert(rollbackCounts.rows[0]?.count === "0", "VLT-01 rollback left partial state.");

  const deleteMutation = {
    baseRevision: 2,
    entityId: recordId,
    entityType: "record" as const,
    idempotencyKey: nextId(),
    localDependencyIds: [],
    mutationId: nextId(),
    operation: "delete" as const,
  };
  const deleted = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [deleteMutation],
  });
  assert(deleted.results[0]?.status === "applied", "VLT-01 delete did not apply.");
  const deleteReplay = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [deleteMutation],
  });
  assert(deleteReplay.results[0]?.status === "duplicate", "VLT-01 delete replay duplicated.");
  assert(
    (await syncService.readRecord({ identityUserId: input.firstUser, recordId })) === null,
    "Deleted VLT-01 record remained readable.",
  );

  const evidence = await client.query<{
    readonly activeTimeline: string;
    readonly audit: string;
    readonly outbox: string;
    readonly purge: string;
    readonly recordChanges: string;
    readonly timelineChanges: string;
    readonly tombstonedTimeline: string;
    readonly versions: string;
  }>(
    `select
       (select count(*)::text from littlearc.record_versions
         where record_id = $1) versions,
       (select count(*)::text from littlearc.audit_events
         where target_id = $1 and result = 'success') audit,
       (select count(*)::text from littlearc.change_events
         where entity_id = $1 and entity_type = 'record') "recordChanges",
       (select count(*)::text from littlearc.change_events
         where entity_type = 'timelineEntry'
           and mutation_id in (
             select request_id from littlearc.audit_events where target_id = $1
           )) "timelineChanges",
       (select count(*)::text from littlearc.outbox_events
         where aggregate_id = $1 and aggregate_type = 'record') outbox,
       (select count(*)::text from littlearc.outbox_events
         where aggregate_id = $1 and event_type = 'record.purge_requested') purge,
       (select count(*)::text from littlearc.timeline_entries
         where source_record_id = $1 and projection_state = 'active') "activeTimeline",
       (select count(*)::text from littlearc.timeline_entries
         where source_record_id = $1 and projection_state = 'tombstoned') "tombstonedTimeline"`,
    [recordId],
  );
  const row = evidence.rows[0];
  assert(
    row?.versions === "2" &&
      row.audit === "3" &&
      row.recordChanges === "3" &&
      row.timelineChanges === "4" &&
      row.outbox === "3" &&
      row.purge === "1" &&
      row.activeTimeline === "0" &&
      row.tombstonedTimeline === "1",
    "VLT-01 version/Timeline/delete evidence is incomplete.",
  );

  const plaintext = JSON.stringify(
    (
      await client.query(
        `select payload from (
           select encrypted_payload::text payload
             from littlearc.record_versions where record_id = $1
           union all
           select encrypted_suggestion::text
             from littlearc.record_suggestions where record_id = $1
           union all
           select encrypted_source_span::text
             from littlearc.record_suggestions where record_id = $1
           union all
           select encrypted_payload::text
             from littlearc.timeline_entries where source_record_id = $1
           union all
           select metadata::text
             from littlearc.audit_events where target_id = $1
           union all
           select payload::text
             from littlearc.change_events
             where entity_id = $1 or mutation_id in (
               select request_id from littlearc.audit_events where target_id = $1
             )
           union all
           select payload::text
             from littlearc.outbox_events where aggregate_id = $1
         ) evidence`,
        [recordId],
      )
    ).rows,
  );
  for (const canary of [
    "VLT01_CANARY_SYNTHETIC_RECORD",
    "VLT01_CANARY_SYNTHETIC_NOTE",
    "VLT01_CANARY_SYNTHETIC_CLINIC",
    "VLT01_CANARY_SYNTHETIC_CORRECTION",
    "VLT01_CANARY_SYNTHETIC_SUGGESTION",
    "VLT01_CANARY_SYNTHETIC_SOURCE_SPAN",
  ]) {
    assert(!plaintext.includes(canary), `VLT-01 plaintext canary leaked: ${canary}`);
  }
  const vlt02Plaintext = JSON.stringify(
    (
      await client.query(
        `select payload from (
           select encrypted_payload::text payload
             from littlearc.record_versions where record_id = any($1::uuid[])
           union all
           select encrypted_payload::text
             from littlearc.timeline_entries where source_record_id = any($1::uuid[])
           union all
           select metadata::text
             from littlearc.audit_events where target_id = any($1::uuid[])
           union all
           select payload::text
             from littlearc.change_events where entity_id = any($1::uuid[])
           union all
           select payload::text
             from littlearc.outbox_events where aggregate_id = any($1::uuid[])
         ) evidence`,
        [manualRecordIds],
      )
    ).rows,
  );
  for (const canary of [
    "VLT02_CANARY_SYNTHETIC_LOT",
    "VLT02_CANARY_SYNTHETIC_VACCINE",
    "VLT02_CANARY_SYNTHETIC_CLINIC",
    "VLT02_CANARY_SYNTHETIC_VISIT_REASON",
    "VLT02_CANARY_SYNTHETIC_TAG",
    "VLT02_CANARY_SYNTHETIC_VISIT_NOTE",
    "VLT02_CANARY_SYNTHETIC_DURATION",
    "VLT02_CANARY_SYNTHETIC_MEDICINE",
    "VLT02_CANARY_SYNTHETIC_WRITTEN_SCHEDULE",
  ]) {
    assert(!vlt02Plaintext.includes(canary), `VLT-02 plaintext canary leaked: ${canary}`);
  }

  const indexes = await client.query<{ readonly indexname: string }>(
    `select indexname from pg_indexes
     where schemaname = 'littlearc'
       and indexname in (
         'records_child_event_idx',
         'record_versions_record_created_idx',
         'timeline_entries_child_event_idx',
         'timeline_entries_one_active_record_idx'
       )`,
  );
  assert(indexes.rowCount === 4, "VLT-01 target query indexes are incomplete.");

  console.log("VLT-01 PostgreSQL record-foundation validation passed.");
  console.log("- Encrypted create, exact replay, correction, history, and stale conflict passed.");
  console.log("- Suggestions remained separate from confirmed and Timeline authority.");
  console.log("- RLS/BOLA, immutable versions, rollback, tombstone, and one purge request passed.");
  console.log("- Record, suggestion, source-span, and Timeline plaintext canaries were absent.");
  console.log("VLT-02 PostgreSQL manual-record validation passed.");
  console.log("- Document, vaccination, doctor-visit, and prescription create/correct passed.");
  console.log("- Manual provenance, immutable history, delete, and plaintext canaries passed.");
}

async function runEmergencyCardAutomated(
  syncService: SyncService,
  client: Client,
  input: {
    readonly firstChildId: UuidV7;
    readonly firstHouseholdId: UuidV7;
    readonly firstUser: string;
    readonly secondUser: string;
  },
): Promise<void> {
  const cardId = nextId();
  const createMutation = {
    baseRevision: null,
    entityId: cardId,
    entityType: "emergencyCard" as const,
    idempotencyKey: nextId(),
    localDependencyIds: [],
    mutationId: nextId(),
    operation: "create" as const,
    payload: {
      accessMode: "standard" as const,
      childId: input.firstChildId,
      content: syntheticEmergencyContent,
    },
  };
  const created = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [createMutation],
  });
  assert(created.results[0]?.status === "applied", "Emergency-card create did not apply.");
  const replay = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [createMutation],
  });
  assert(replay.results[0]?.status === "duplicate", "Emergency-card replay was not duplicate.");
  const mismatch = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [
      {
        ...createMutation,
        payload: {
          ...createMutation.payload,
          content: {
            ...syntheticEmergencyContent,
            bloodGroup: { state: "notProvided" as const },
          },
        },
      },
    ],
  });
  assert(
    mismatch.results[0]?.status === "rejected" &&
      mismatch.results[0].reason === "idempotencyMismatch",
    "Changed emergency-card replay did not fail closed.",
  );

  const updateMutation = {
    ...createMutation,
    baseRevision: 1,
    idempotencyKey: nextId(),
    mutationId: nextId(),
    operation: "update" as const,
    payload: {
      ...createMutation.payload,
      content: {
        ...syntheticEmergencyContent,
        criticalNotes: { state: "confirmed" as const, values: ["Synthetic updated note"] },
      },
    },
  };
  const updated = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [updateMutation],
  });
  assert(updated.results[0]?.status === "applied", "Emergency-card update did not apply.");
  const stale = await syncService.push({
    identityUserId: input.firstUser,
    mutations: [
      {
        ...updateMutation,
        idempotencyKey: nextId(),
        mutationId: nextId(),
      },
    ],
  });
  assert(stale.results[0]?.status === "conflict", "Stale emergency-card edit did not conflict.");

  const card = await syncService.readEmergencyCard({ cardId, identityUserId: input.firstUser });
  assert(card?.revision === 2 && card.version === 2, "Current emergency-card version is invalid.");
  const crossHousehold = await syncService.readEmergencyCard({
    cardId,
    identityUserId: input.secondUser,
  });
  assert(crossHousehold === null, "Cross-household emergency card was visible.");

  const rows = await client.query<{
    readonly audit: string;
    readonly changes: string;
    readonly outbox: string;
    readonly versions: string;
  }>(
    `select
      (select count(*)::text from littlearc.emergency_card_versions
        where emergency_card_id = $1) versions,
      (select count(*)::text from littlearc.audit_events
        where target_id = $1 and result = 'success') audit,
      (select count(*)::text from littlearc.change_events
        where entity_id = $1 and entity_type = 'emergencyCard') changes,
      (select count(*)::text from littlearc.outbox_events
        where aggregate_id = $1 and aggregate_type = 'emergency_card') outbox`,
    [cardId],
  );
  assert(
    rows.rows[0]?.versions === "2" &&
      rows.rows[0].audit === "2" &&
      rows.rows[0].changes === "2" &&
      rows.rows[0].outbox === "2",
    "Emergency-card immutable history evidence is incomplete.",
  );
  let immutableCode: string | undefined;
  try {
    await client.query(
      "update littlearc.emergency_card_versions set source_revision = 9 where emergency_card_id = $1",
      [cardId],
    );
  } catch (error) {
    immutableCode =
      error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
  }
  assert(immutableCode === "42501", "Emergency-card immutable history accepted an update.");

  const persisted = JSON.stringify(
    (
      await client.query(
        `select encrypted_payload, audit_events.metadata, change_events.payload, outbox_events.payload
         from littlearc.emergency_card_versions
         join littlearc.audit_events on audit_events.target_id = emergency_card_versions.emergency_card_id
         join littlearc.change_events on change_events.entity_id = emergency_card_versions.emergency_card_id
         join littlearc.outbox_events on outbox_events.aggregate_id = emergency_card_versions.emergency_card_id
         where emergency_card_versions.emergency_card_id = $1`,
        [cardId],
      )
    ).rows,
  );
  for (const canary of [
    "Synthetic critical note",
    "Synthetic updated note",
    "Synthetic Guardian",
    "+919999999999",
  ]) {
    assert(!persisted.includes(canary), "Emergency-card plaintext reached PostgreSQL evidence.");
  }
  console.log("OFF-05 PostgreSQL emergency-card validation passed.");
  console.log(
    "- Encrypted create, immutable version update, exact replay, and stale conflict passed.",
  );
  console.log("- Cross-household isolation, minimized evidence, and plaintext canaries passed.");
  console.log(`- Emergency-card household: ${input.firstHouseholdId}.`);
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
  const userId = "synthetic-off02-device";
  await insertAuthUser(client, userId, "synthetic.off02.device@example.test");
  const validatingCommand: OwnerOnboardingCommand = {
    async execute(input) {
      const result = await command.execute(input);
      await assertDatabaseEvidence(client);
      console.log("OFF-02 device HTTP/database path passed.");
      return result;
    },
  };
  const server = await createApiServer(
    loadApiConfig({ APP_ENV: "local", HOST: "127.0.0.1", PORT: String(deviceApiPort) }),
    undefined,
    undefined,
    {
      command: validatingCommand,
      async getSessionIdentity(headers) {
        return headers.get("x-littlearc-synthetic-session") === "off02-device-validation"
          ? { userId }
          : null;
      },
    },
  );
  await server.register(rateLimit, { global: true, max: 120, timeWindow: 60_000 });
  await server.listen({ host: "127.0.0.1", port: deviceApiPort });
  console.log(`OFF-02 synthetic device API listening on 127.0.0.1:${deviceApiPort}.`);
  return async () => server.close();
}

async function serveOff03Device(
  onboardingCommand: OwnerOnboardingCommand,
  deviceCommand: DeviceEnrollmentCommand,
  client: Client,
): Promise<() => Promise<void>> {
  const userId = "synthetic-off03-device";
  await insertAuthUser(client, userId, "synthetic.off03.device@example.test");
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
      console.log("OFF-03 device HTTP/database path passed.");
      return result;
    },
  };
  const server = await createApiServer(
    loadApiConfig({ APP_ENV: "local", HOST: "127.0.0.1", PORT: String(deviceApiPort) }),
    undefined,
    undefined,
    undefined,
    {
      command: validatingCommand,
      async getSessionIdentity(headers) {
        return headers.get("x-littlearc-synthetic-session") === "off03-device-validation"
          ? { userId }
          : null;
      },
    },
  );
  await server.register(rateLimit, { global: true, max: 120, timeWindow: 60_000 });
  await server.listen({ host: "127.0.0.1", port: deviceApiPort });
  console.log(`OFF-03 synthetic device API listening on 127.0.0.1:${deviceApiPort}.`);
  return async () => server.close();
}

async function serveOff04Device(
  onboardingCommand: OwnerOnboardingCommand,
  deviceCommand: DeviceEnrollmentCommand,
  syncService: SyncService,
  client: Client,
): Promise<() => Promise<void>> {
  const userId = "synthetic-off04-device";
  await insertAuthUser(client, userId, "synthetic.off04.device@example.test");
  const onboarding = await execute(onboardingCommand, userId);
  const getSessionIdentity = async (headers: Headers) =>
    headers.get("x-littlearc-synthetic-session") === "off04-device-validation" ? { userId } : null;
  const validatingSyncService: SyncService = {
    readEmergencyCard: syncService.readEmergencyCard,
    readRecord: syncService.readRecord,
    readRecordVersions: syncService.readRecordVersions,
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
    loadApiConfig({ APP_ENV: "local", HOST: "127.0.0.1", PORT: String(deviceApiPort) }),
    undefined,
    undefined,
    undefined,
    { command: deviceCommand, getSessionIdentity },
    { getSessionIdentity, service: validatingSyncService },
  );
  await server.register(rateLimit, { global: true, max: 120, timeWindow: 60_000 });

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

  await server.listen({ host: "127.0.0.1", port: deviceApiPort });
  console.log(`OFF-04 synthetic device API listening on 127.0.0.1:${deviceApiPort}.`);
  return async () => server.close();
}

async function serveOff05Device(
  onboardingCommand: OwnerOnboardingCommand,
  deviceCommand: DeviceEnrollmentCommand,
  syncService: SyncService,
  client: Client,
): Promise<() => Promise<void>> {
  const userId = "synthetic-off05-device";
  await insertAuthUser(client, userId, "synthetic.off05.device@example.test");
  const onboarding = await execute(onboardingCommand, userId);
  const cardId = nextId();
  const getSessionIdentity = async (headers: Headers) =>
    headers.get("x-littlearc-synthetic-session") === "off05-device-validation" ? { userId } : null;
  const server = await createApiServer(
    loadApiConfig({ APP_ENV: "local", HOST: "127.0.0.1", PORT: String(deviceApiPort) }),
    undefined,
    undefined,
    undefined,
    { command: deviceCommand, getSessionIdentity },
    { getSessionIdentity, service: syncService },
  );
  await server.register(rateLimit, { global: true, max: 120, timeWindow: 60_000 });
  let apiAvailable = true;

  server.addHook("onRequest", async (request, reply) => {
    if (!apiAvailable && request.url !== "/v1/validation/off05/connectivity") {
      return reply.status(503).send({ error: "synthetic_api_unavailable" });
    }
  });

  server.get("/v1/validation/off05/connectivity", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    return { available: apiAvailable };
  });
  server.post("/v1/validation/off05/connectivity", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const body = request.body as { readonly available?: unknown };
    if (typeof body.available !== "boolean") {
      return reply.status(400).send({ error: "invalid_availability" });
    }
    apiAvailable = body.available;
    console.log(`OFF-05 synthetic API ${apiAvailable ? "restored" : "unavailable"}.`);
    return { available: apiAvailable };
  });

  server.get("/v1/validation/off05/bootstrap", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    return {
      cardId,
      childId: onboarding.childId,
      householdId: onboarding.householdId,
    };
  });
  server.post("/v1/validation/off05/remote-edit", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const result = await syncService.push({
      identityUserId: userId,
      mutations: [
        {
          baseRevision: 1,
          entityId: cardId,
          entityType: "emergencyCard",
          idempotencyKey: nextId(),
          localDependencyIds: [],
          mutationId: nextId(),
          operation: "update",
          payload: {
            accessMode: "standard",
            childId: onboarding.childId,
            content: {
              ...syntheticEmergencyContent,
              criticalNotes: {
                state: "confirmed",
                values: ["Synthetic remote critical note"],
              },
            },
          },
        },
      ],
    });
    assert(result.results[0]?.status === "applied", "OFF-05 remote edit did not apply.");
    console.log("OFF-05 simulated remote writer applied emergency-card revision 2.");
    return result;
  });
  server.get("/v1/validation/off05/evidence", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const result = await client.query<{
      readonly audit: string;
      readonly changes: string;
      readonly outbox: string;
      readonly revision: number;
      readonly versions: string;
    }>(
      `select
        (select count(*)::text from littlearc.emergency_card_versions
          where emergency_card_id = $1) versions,
        (select count(*)::text from littlearc.audit_events
          where target_id = $1 and result = 'success') audit,
        (select count(*)::text from littlearc.change_events
          where entity_id = $1 and entity_type = 'emergencyCard') changes,
        (select count(*)::text from littlearc.outbox_events
          where aggregate_id = $1 and aggregate_type = 'emergency_card') outbox,
        (select revision from littlearc.emergency_cards where id = $1) revision`,
      [cardId],
    );
    return result.rows[0];
  });

  await server.listen({ host: "127.0.0.1", port: deviceApiPort });
  console.log(`OFF-05 synthetic device API listening on 127.0.0.1:${deviceApiPort}.`);
  return async () => server.close();
}

async function serveVlt01Device(
  onboardingCommand: OwnerOnboardingCommand,
  deviceCommand: DeviceEnrollmentCommand,
  syncService: SyncService,
  client: Client,
): Promise<() => Promise<void>> {
  const userId = "synthetic-vlt01-device";
  await insertAuthUser(client, userId, "synthetic.vlt01.device@example.test");
  const onboarding = await execute(onboardingCommand, userId);
  const recordId = nextId();
  const getSessionIdentity = async (headers: Headers) =>
    headers.get("x-littlearc-synthetic-session") === "vlt01-device-validation" ? { userId } : null;
  const server = await createApiServer(
    loadApiConfig({ APP_ENV: "local", HOST: "127.0.0.1", PORT: String(deviceApiPort) }),
    undefined,
    undefined,
    undefined,
    { command: deviceCommand, getSessionIdentity },
    { getSessionIdentity, service: syncService },
  );
  await server.register(rateLimit, { global: true, max: 120, timeWindow: 60_000 });
  let apiAvailable = true;

  server.addHook("onRequest", async (request, reply) => {
    if (!apiAvailable && request.url !== "/v1/validation/vlt01/connectivity") {
      return reply.status(503).send({ error: "synthetic_api_unavailable" });
    }
  });

  server.get("/v1/validation/vlt01/connectivity", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    return { available: apiAvailable };
  });
  server.post("/v1/validation/vlt01/connectivity", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const body = request.body as { readonly available?: unknown };
    if (typeof body.available !== "boolean") {
      return reply.status(400).send({ error: "invalid_availability" });
    }
    apiAvailable = body.available;
    console.log(`VLT-01 synthetic API ${apiAvailable ? "restored" : "unavailable"}.`);
    return { available: apiAvailable };
  });

  server.get("/v1/validation/vlt01/bootstrap", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    return {
      childId: onboarding.childId,
      householdId: onboarding.householdId,
      recordId,
    };
  });
  server.post("/v1/validation/vlt01/remote-edit", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const result = await syncService.push({
      identityUserId: userId,
      mutations: [
        {
          baseRevision: 2,
          entityId: recordId,
          entityType: "record",
          idempotencyKey: nextId(),
          localDependencyIds: [],
          mutationId: nextId(),
          operation: "update",
          payload: {
            category: "document",
            childId: onboarding.childId,
            content: {
              details: {
                documentKind: {
                  state: "confirmed",
                  value: "Synthetic remote visit summary",
                },
                schema: "document.v1",
              },
              notes: {
                state: "confirmed",
                value: "Synthetic remote correction",
              },
              providerFacility: {
                state: "confirmed",
                value: "Synthetic Clinic",
              },
              schemaVersion: 1,
              title: "Synthetic remote visit",
            },
            eventAt: "2026-07-20T09:00:00.000Z",
            sourceType: "manual",
          },
        },
      ],
    });
    assert(result.results[0]?.status === "applied", "VLT-01 remote edit did not apply.");
    console.log("VLT-01 simulated remote writer applied record revision 3.");
    return result;
  });
  server.get("/v1/validation/vlt01/evidence", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const result = await client.query<{
      readonly activeTimeline: string;
      readonly audit: string;
      readonly recordChanges: string;
      readonly revision: number;
      readonly timelineChanges: string;
      readonly versions: string;
    }>(
      `select
        (select count(*)::text from littlearc.record_versions
          where record_id = $1) versions,
        (select count(*)::text from littlearc.audit_events
          where target_id = $1 and result = 'success') audit,
        (select count(*)::text from littlearc.change_events
          where entity_id = $1 and entity_type = 'record') "recordChanges",
        (select count(*)::text from littlearc.change_events
          where entity_type = 'timelineEntry'
            and entity_id in (
              select id from littlearc.timeline_entries where source_record_id = $1
            )) "timelineChanges",
        (select count(*)::text from littlearc.timeline_entries
          where source_record_id = $1
            and projection_state = 'active'
            and deleted_at is null) "activeTimeline",
        (select revision from littlearc.records where id = $1) revision`,
      [recordId],
    );
    return result.rows[0];
  });

  await server.listen({ host: "127.0.0.1", port: deviceApiPort });
  console.log(`VLT-01 synthetic device API listening on 127.0.0.1:${deviceApiPort}.`);
  return async () => server.close();
}

async function serveVlt04Device(
  onboardingCommand: OwnerOnboardingCommand,
  deviceCommand: DeviceEnrollmentCommand,
  database: ReturnType<typeof createDatabaseConnection>["database"],
  crypto: StructuredPayloadCrypto,
  client: Client,
): Promise<() => Promise<void>> {
  const userId = "synthetic-vlt04-device";
  await insertAuthUser(client, userId, "synthetic.vlt04.device@example.test");
  const onboarding = await execute(onboardingCommand, userId);
  const memory = createMemoryEncryptedObjectStorage();
  let failSecondPartOnce = true;
  let tamperNextDownload = false;
  const baseUrl = `http://127.0.0.1:${deviceApiPort}`;
  const storage: EncryptedObjectStorage = {
    ...memory,
    async signDownload(input) {
      await memory.headObject(input.objectKey);
      return `${baseUrl}/v1/validation/vlt04/provider/download?objectKey=${encodeURIComponent(input.objectKey)}`;
    },
    async signUploadPart(input) {
      await memory.listParts({
        objectKey: input.objectKey,
        providerUploadId: input.providerUploadId,
      });
      return `${baseUrl}/v1/validation/vlt04/provider/upload/${encodeURIComponent(input.providerUploadId)}/${input.partNumber}?objectKey=${encodeURIComponent(input.objectKey)}`;
    },
  };
  const getSessionIdentity = async (headers: Headers) =>
    headers.get("x-littlearc-synthetic-session") === "vlt04-device-validation" ? { userId } : null;
  const service = createFileUploadService({
    enabled: true,
    persistence: createFileUploadPersistence({
      crypto,
      database,
      fileKeyCrypto: createFileKeyCrypto({ currentKeyVersion: 1 }),
    }),
    storage,
  });
  const server = await createApiServer(
    {
      ...loadApiConfig({ APP_ENV: "local", HOST: "127.0.0.1", PORT: String(deviceApiPort) }),
      uploadsEnabled: true,
    },
    undefined,
    undefined,
    undefined,
    { command: deviceCommand, getSessionIdentity },
    undefined,
    { getSessionIdentity, service },
  );
  await server.register(rateLimit, { global: true, max: 120, timeWindow: 60_000 });

  server.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer" },
    (_request, body, done) => done(null, body),
  );
  server.addHook("onError", async (request, _reply, error) => {
    console.error(
      `VLT-04 synthetic route failed: ${request.method} ${request.routeOptions.url}: ${error.message}`,
    );
  });
  server.post("/v1/validation/vlt04/bootstrap", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const body = request.body as {
      readonly appVersion?: unknown;
      readonly deviceId?: unknown;
      readonly platform?: unknown;
    };
    if (
      typeof body.appVersion !== "string" ||
      typeof body.deviceId !== "string" ||
      (body.platform !== "android" && body.platform !== "ios")
    ) {
      return reply.status(400).send({ error: "invalid_bootstrap" });
    }
    await deviceCommand.execute({
      identityUserId: userId,
      request: {
        appVersion: body.appVersion,
        deviceId: body.deviceId as UuidV7,
        localSchemaVersion: 8,
        platform: body.platform,
      },
      requestId: nextId(),
    });
    return {
      childId: onboarding.childId,
      householdId: onboarding.householdId,
    };
  });
  server.put(
    "/v1/validation/vlt04/provider/upload/:uploadId/:partNumber",
    { bodyLimit: 5 * 1024 * 1024 },
    async (request, reply) => {
      const parameters = request.params as {
        readonly partNumber: string;
        readonly uploadId: string;
      };
      const query = request.query as { readonly objectKey?: string };
      const partNumber = Number(parameters.partNumber);
      if (!query.objectKey || !Number.isInteger(partNumber)) {
        return reply.status(400).send({ error: "invalid_part" });
      }
      if (partNumber === 2 && failSecondPartOnce) {
        failSecondPartOnce = false;
        return reply.status(503).send({ error: "synthetic_network_interruption" });
      }
      const part = await memory.putPart({
        bytes: request.body as Buffer,
        objectKey: query.objectKey,
        partNumber,
        providerUploadId: parameters.uploadId,
      });
      return reply.header("etag", part.etag).status(200).send();
    },
  );
  server.get("/v1/validation/vlt04/provider/download", async (request, reply) => {
    const query = request.query as { readonly objectKey?: string };
    const object = query.objectKey ? memory.readObject(query.objectKey) : undefined;
    if (!object) {
      return reply.status(404).send({ error: "not_found" });
    }
    const bytes = Buffer.from(object);
    if (tamperNextDownload) {
      tamperNextDownload = false;
      bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
    }
    return reply.type("application/octet-stream").send(bytes);
  });
  server.post("/v1/validation/vlt04/tamper-next-download", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    tamperNextDownload = true;
    return { ready: true };
  });
  server.get("/v1/validation/vlt04/evidence", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const result = await client.query<{
      readonly completed: string;
      readonly created: string;
      readonly downloaded: string;
      readonly files: string;
    }>(
      `select
         (select count(*)::text from littlearc.file_objects) files,
         (select count(*)::text from littlearc.audit_events
           where action = 'file_upload_created') created,
         (select count(*)::text from littlearc.audit_events
           where action = 'file_upload_completed') completed,
         (select count(*)::text from littlearc.audit_events
           where action = 'file_download_authorized') downloaded`,
    );
    return result.rows[0];
  });

  await server.listen({ host: "127.0.0.1", port: deviceApiPort });
  console.log(`VLT-04 synthetic device API listening on 127.0.0.1:${deviceApiPort}.`);
  return async () => server.close();
}

async function serveOff06Device(
  onboardingCommand: OwnerOnboardingCommand,
  deviceCommand: DeviceEnrollmentCommand,
  syncService: SyncService,
  client: Client,
): Promise<() => Promise<void>> {
  const userId = "synthetic-off06-device";
  await insertAuthUser(client, userId, "synthetic.off06.device@example.test");
  const getSessionIdentity = async (headers: Headers) =>
    headers.get("x-littlearc-synthetic-session") === "off06-device-validation" ? { userId } : null;
  const server = await createApiServer(
    loadApiConfig({ APP_ENV: "local", HOST: "127.0.0.1", PORT: String(deviceApiPort) }),
    undefined,
    undefined,
    { command: onboardingCommand, getSessionIdentity },
    { command: deviceCommand, getSessionIdentity },
    { getSessionIdentity, service: syncService },
  );
  await server.register(rateLimit, { global: true, max: 120, timeWindow: 60_000 });

  server.get("/v1/validation/off06/session", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    return { ready: true };
  });

  server.get("/v1/validation/off06/evidence", async (request, reply) => {
    if (!(await getSessionIdentity(new Headers(request.headers as Record<string, string>)))) {
      return reply.status(401).send({ error: "authentication_required" });
    }
    const result = await client.query<{
      readonly cards: string;
      readonly children: string;
      readonly consents: string;
      readonly devices: string;
      readonly households: string;
      readonly versions: string;
    }>(
      `with owner_household as (
         select household_id
         from littlearc.household_memberships
         where user_id = $1 and role = 'owner' and status = 'active'
       )
       select
         (select count(*)::text from owner_household) households,
         (select count(*)::text from littlearc.children
           where household_id = (select household_id from owner_household)) children,
         (select count(*)::text from littlearc.consent_events
           where household_id = (select household_id from owner_household)
             and state = 'granted'
             and purpose in ('parent_notice', 'child_data_processing')) consents,
         (select count(*)::text from littlearc.devices
           where user_id = $1 and enrollment_status = 'active') devices,
         (select count(*)::text from littlearc.emergency_cards
           where household_id = (select household_id from owner_household)
             and status = 'active') cards,
         (select count(*)::text from littlearc.emergency_card_versions
           where household_id = (select household_id from owner_household)) versions`,
      [userId],
    );
    const evidence = result.rows[0];
    assert(evidence, "OFF-06 evidence counts were unavailable.");
    const passed =
      evidence.households === "1" &&
      evidence.children === "1" &&
      evidence.consents === "2" &&
      evidence.devices === "1" &&
      evidence.cards === "1" &&
      evidence.versions === "1";
    assert(passed, "OFF-06 composed server evidence was incomplete.");
    console.log("OFF-06 device HTTP/database composition passed.");
    return { ...evidence, status: "passed" };
  });

  await server.listen({ host: "127.0.0.1", port: deviceApiPort });
  console.log(`OFF-06 synthetic device API listening on 127.0.0.1:${deviceApiPort}.`);
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
    await prepareAndVerifyFileValidationQueue(databaseClient, databaseUrl);
    await databaseClient.query(
      `grant littlearc_app, littlearc_worker to ${quoteIdentifier(currentUser)}`,
    );
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

    if (vlt04DeviceMode) {
      closeServer = await serveVlt04Device(
        command,
        deviceCommand,
        connection.database,
        crypto,
        databaseClient,
      );
      await new Promise<void>((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
    } else if (vlt01DeviceMode) {
      closeServer = await serveVlt01Device(command, deviceCommand, syncService, databaseClient);
      await new Promise<void>((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
    } else if (off06DeviceMode) {
      closeServer = await serveOff06Device(command, deviceCommand, syncService, databaseClient);
      await new Promise<void>((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
    } else if (off05DeviceMode) {
      closeServer = await serveOff05Device(command, deviceCommand, syncService, databaseClient);
      await new Promise<void>((resolve) => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
      });
    } else if (off04DeviceMode) {
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
      await runAutomated(
        command,
        deviceCommand,
        databaseClient,
        currentUser,
        syncService,
        crypto,
        connection.database,
      );
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
