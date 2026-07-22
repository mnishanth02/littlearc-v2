import { createUuidV7 } from "@littlearc/domain";
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { applyLocalMigrations } from "./migrations";
import {
  type LocalEnrollmentMarker,
  localAppLockPolicy,
  localSchemaVersion,
  parseLocalEnrollmentMarker,
  resolveLocalSecurityState,
} from "./policy";

const databaseName = "littlearc-local-v1.db";
const databaseKeyName = "littlearc.local-security.database-key.v1";
const enrollmentMarkerName = "littlearc.local-security.enrollment.v1";
const fileKeyIndexName = "littlearc.local-security.file-key-index.v1";
const fileKeyPrefix = "littlearc.local-security.file-key.v1.";
const encryptedFileDirectoryName = "littlearc-encrypted-files-v1";

const deviceOnlyOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;
const protectedOptions = {
  ...deviceOnlyOptions,
  authenticationPrompt: "Unlock LittleArc local data",
  requireAuthentication: true,
} as const;

export type LocalSecurityCapability = {
  readonly authenticationTypeCount: number;
  readonly enrolled: boolean;
  readonly hardware: boolean;
  readonly secureStoreBiometricProtection: boolean;
  readonly securityLevel: LocalAuthentication.SecurityLevel;
  readonly strongBiometricReady: boolean;
};

export async function inspectLocalSecurityCapability(): Promise<LocalSecurityCapability> {
  const [hardware, enrolled, securityLevel, authenticationTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const secureStoreBiometricProtection = SecureStore.canUseBiometricAuthentication();
  return {
    authenticationTypeCount: authenticationTypes.length,
    enrolled,
    hardware,
    secureStoreBiometricProtection,
    securityLevel,
    strongBiometricReady:
      hardware &&
      enrolled &&
      secureStoreBiometricProtection &&
      securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG,
  };
}

export async function enrollLocalSecurity(input: {
  readonly deviceId: string;
  readonly householdId: string;
}): Promise<{ readonly cipherVersion: string; readonly generationId: string }> {
  const capability = await inspectLocalSecurityCapability();
  if (!capability.strongBiometricReady) {
    throw new Error("Strong biometric protection is required for this local enrollment.");
  }
  const existingMarker = await SecureStore.getItemAsync(enrollmentMarkerName, deviceOnlyOptions);
  if (existingMarker) {
    throw new Error("This installation already has a local enrollment.");
  }
  const databaseKey = bytesToHex(Crypto.getRandomBytes(32));
  const marker: LocalEnrollmentMarker = {
    appLockPolicy: localAppLockPolicy,
    deviceId: input.deviceId,
    generationId: createUuidV7(Crypto.getRandomBytes(10)),
    householdId: input.householdId,
    localSchemaVersion,
  };
  let database: SQLite.SQLiteDatabase | undefined;
  try {
    await SecureStore.setItemAsync(databaseKeyName, databaseKey, protectedOptions);
    await SecureStore.setItemAsync(enrollmentMarkerName, JSON.stringify(marker), deviceOnlyOptions);
    const enrolledDatabase = await openEncryptedDatabase(databaseKey);
    database = enrolledDatabase;
    const cipherVersion = await withLocalSecurityStage("SQLCipher capability check", () =>
      requireCipher(enrolledDatabase),
    );
    await withLocalSecurityStage("local schema migration", () =>
      applyLocalMigrations(enrolledDatabase),
    );
    await withLocalSecurityStage("encrypted database configuration", () =>
      enrolledDatabase.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;"),
    );
    await withLocalSecurityStage("local enrollment record", () =>
      enrolledDatabase.runAsync(
        `INSERT OR REPLACE INTO local_enrollment (
          singleton, device_id, household_id, generation_id, app_lock_policy, created_at
        ) VALUES (1, ?, ?, ?, ?, ?)`,
        marker.deviceId,
        marker.householdId,
        marker.generationId,
        marker.appLockPolicy,
        new Date().toISOString(),
      ),
    );
    return { cipherVersion, generationId: marker.generationId };
  } catch (error) {
    await database?.closeAsync();
    database = undefined;
    await wipeLocalSecurity();
    throw error;
  } finally {
    await database?.closeAsync();
  }
}

export async function validateUnlockedLocalSecurity(): Promise<{
  readonly cipherVersion: string;
  readonly fileTamperRejected: boolean;
  readonly fileWrongAadRejected: boolean;
  readonly migrationVersion: number;
  readonly reopenPassed: boolean;
  readonly wrongDatabaseKeyRejected: boolean;
}> {
  const markerValue = await SecureStore.getItemAsync(enrollmentMarkerName, deviceOnlyOptions);
  if (!markerValue) {
    throw new Error("This installation is not enrolled.");
  }
  const marker = parseLocalEnrollmentMarker(markerValue);
  const databaseKey = await SecureStore.getItemAsync(databaseKeyName, protectedOptions);
  const state = resolveLocalSecurityState({
    enrollmentMarkerPresent: true,
    protectedKeyState: databaseKey ? "available" : "missing",
  });
  if (state !== "ready" || !databaseKey) {
    throw new Error("Account reauthentication is required before local data can be rebuilt.");
  }

  const first = await openEncryptedDatabase(databaseKey);
  let cipherVersion: string;
  try {
    cipherVersion = await requireCipher(first);
    await applyLocalMigrations(first);
    if (marker.localSchemaVersion !== localSchemaVersion) {
      await SecureStore.setItemAsync(
        enrollmentMarkerName,
        JSON.stringify({ ...marker, localSchemaVersion }),
        deviceOnlyOptions,
      );
    }
  } finally {
    await first.closeAsync();
  }
  const reopened = await openEncryptedDatabase(databaseKey);
  let fileValidation: {
    readonly fileTamperRejected: boolean;
    readonly fileWrongAadRejected: boolean;
  };
  let migrationVersion: number;
  try {
    await requireCipher(reopened);
    const migration = await reopened.getFirstAsync<{ readonly version: number }>(
      "SELECT MAX(version) AS version FROM local_schema_migrations",
    );
    const enrollment = await reopened.getFirstAsync<{ readonly generationId: string }>(
      "SELECT generation_id AS generationId FROM local_enrollment WHERE singleton = 1",
    );
    if (
      migration?.version !== localSchemaVersion ||
      enrollment?.generationId !== marker.generationId
    ) {
      throw new Error("The keyed database reopen returned inconsistent enrollment state.");
    }
    migrationVersion = migration.version;
    fileValidation = await validateEncryptedFilePrimitive(reopened);
  } finally {
    await reopened.closeAsync();
  }
  return {
    cipherVersion,
    ...fileValidation,
    migrationVersion,
    reopenPassed: true,
    wrongDatabaseKeyRejected: await wrongDatabaseKeyIsRejected(),
  };
}

export async function withUnlockedLocalDatabase<T>(
  task: (database: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const markerValue = await SecureStore.getItemAsync(enrollmentMarkerName, deviceOnlyOptions);
  if (!markerValue) {
    throw new Error("This installation is not enrolled.");
  }
  parseLocalEnrollmentMarker(markerValue);
  const databaseKey = await SecureStore.getItemAsync(databaseKeyName, protectedOptions);
  if (!databaseKey) {
    throw new Error("Account reauthentication is required before synchronization.");
  }
  const database = await openEncryptedDatabase(databaseKey);
  try {
    await requireCipher(database);
    await applyLocalMigrations(database);
    await database.execAsync("PRAGMA foreign_keys = ON;");
    return await task(database);
  } finally {
    await database.closeAsync();
  }
}

export async function simulateProtectedKeyInvalidationForValidation(): Promise<void> {
  if (!__DEV__) {
    throw new Error("Synthetic key invalidation is development-only.");
  }
  await SecureStore.deleteItemAsync(databaseKeyName);
}

export async function confirmReauthenticationRequired(): Promise<boolean> {
  const marker = await SecureStore.getItemAsync(enrollmentMarkerName, deviceOnlyOptions);
  const key = await SecureStore.getItemAsync(databaseKeyName, protectedOptions);
  return (
    resolveLocalSecurityState({
      enrollmentMarkerPresent: Boolean(marker),
      protectedKeyState: key ? "available" : "missing",
    }) === "reauthentication_required"
  );
}

export async function wipeLocalSecurity(): Promise<void> {
  const fileIds = await readFileKeyIndex();
  await Promise.all(fileIds.map((fileId) => SecureStore.deleteItemAsync(fileKeyName(fileId))));
  const directory = encryptedFileDirectory();
  if (directory.exists) {
    directory.delete();
  }
  const [databaseFile, ...sidecars] = databaseArtifactFiles();
  if (databaseFile?.exists) {
    await SQLite.deleteDatabaseAsync(databaseName);
  }
  for (const sidecar of sidecars) {
    if (sidecar.exists) {
      sidecar.delete();
    }
  }
  await Promise.all([
    SecureStore.deleteItemAsync(databaseKeyName),
    SecureStore.deleteItemAsync(enrollmentMarkerName),
    SecureStore.deleteItemAsync(fileKeyIndexName),
  ]);
}

export async function verifyLocalSecurityWiped(): Promise<boolean> {
  const [databaseKey, marker, fileIndex] = await Promise.all([
    SecureStore.getItemAsync(databaseKeyName, deviceOnlyOptions),
    SecureStore.getItemAsync(enrollmentMarkerName, deviceOnlyOptions),
    SecureStore.getItemAsync(fileKeyIndexName, deviceOnlyOptions),
  ]);
  return (
    !databaseKey &&
    !marker &&
    !fileIndex &&
    !encryptedFileDirectory().exists &&
    !databaseArtifactsExist()
  );
}

async function validateEncryptedFilePrimitive(database: SQLite.SQLiteDatabase): Promise<{
  readonly fileTamperRejected: boolean;
  readonly fileWrongAadRejected: boolean;
}> {
  const fileId = createUuidV7(Crypto.getRandomBytes(10));
  const opaqueName = `${fileId}.lac`;
  const aad = `littlearc-local-file:v1:${fileId}:synthetic-emergency-photo`;
  const plaintext = new TextEncoder().encode("OFF-03 synthetic encrypted file");
  const key = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
  const encodedKey = await key.encoded("base64");
  const directory = encryptedFileDirectory();
  const file = new File(directory, opaqueName);
  let metadataInserted = false;
  try {
    await SecureStore.setItemAsync(fileKeyName(fileId), encodedKey, protectedOptions);
    await addFileKeyToIndex(fileId);
    const sealed = await Crypto.aesEncryptAsync(plaintext, key, {
      additionalData: new TextEncoder().encode(aad),
      nonce: { length: 12 },
      tagLength: 16,
    });
    const combined = await sealed.combined("bytes");
    if (typeof combined === "string") {
      throw new Error("The encrypted file primitive returned an unexpected encoding.");
    }
    directory.create({ idempotent: true, intermediates: true });
    file.create({ overwrite: false });
    file.write(combined);
    await database.runAsync(
      `INSERT INTO local_encrypted_files (
        file_id, opaque_name, aad, ciphertext_bytes, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
      fileId,
      opaqueName,
      aad,
      combined.length,
      new Date().toISOString(),
    );
    metadataInserted = true;
    const storedKey = await SecureStore.getItemAsync(fileKeyName(fileId), protectedOptions);
    if (!storedKey) {
      throw new Error("The protected local-file key is unavailable.");
    }
    const imported = await Crypto.AESEncryptionKey.import(storedKey, "base64");
    const storedCiphertext = await file.bytes();
    const opened = await Crypto.aesDecryptAsync(
      Crypto.AESSealedData.fromCombined(storedCiphertext),
      imported,
      {
        additionalData: new TextEncoder().encode(aad),
        output: "bytes",
      },
    );
    if (typeof opened === "string" || !equalBytes(opened, plaintext)) {
      throw new Error("The encrypted local-file round trip returned different plaintext.");
    }
    let fileWrongAadRejected = false;
    try {
      await Crypto.aesDecryptAsync(Crypto.AESSealedData.fromCombined(storedCiphertext), imported, {
        additionalData: new TextEncoder().encode(`${aad}:wrong`),
        output: "bytes",
      });
    } catch {
      fileWrongAadRejected = true;
    }
    const tampered = storedCiphertext.slice();
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
    let fileTamperRejected = false;
    try {
      await Crypto.aesDecryptAsync(Crypto.AESSealedData.fromCombined(tampered), imported, {
        additionalData: new TextEncoder().encode(aad),
        output: "bytes",
      });
    } catch {
      fileTamperRejected = true;
    }
    if (!fileWrongAadRejected || !fileTamperRejected) {
      throw new Error("The encrypted local-file primitive accepted modified authentication data.");
    }
    return { fileTamperRejected, fileWrongAadRejected };
  } finally {
    if (file.exists) {
      file.delete();
    }
    if (metadataInserted) {
      await database.runAsync("DELETE FROM local_encrypted_files WHERE file_id = ?", fileId);
    }
    await SecureStore.deleteItemAsync(fileKeyName(fileId));
    await removeFileKeyFromIndex(fileId);
  }
}

async function openEncryptedDatabase(key: string): Promise<SQLite.SQLiteDatabase> {
  if (!/^[0-9a-f]{64}$/.test(key)) {
    throw new Error("The local database key has an invalid shape.");
  }
  const database = await SQLite.openDatabaseAsync(databaseName, { useNewConnection: true });
  await database.execAsync(`PRAGMA key = "x'${key}'";`);
  return database;
}

async function requireCipher(database: SQLite.SQLiteDatabase): Promise<string> {
  const cipher = await database.getFirstAsync<{ readonly cipher_version: string }>(
    "PRAGMA cipher_version;",
  );
  if (!cipher?.cipher_version) {
    throw new Error("SQLCipher is not active for the local database.");
  }
  return cipher.cipher_version;
}

async function wrongDatabaseKeyIsRejected(): Promise<boolean> {
  const wrongKey = bytesToHex(Crypto.getRandomBytes(32));
  const database = await openEncryptedDatabase(wrongKey);
  try {
    await database.getFirstAsync("SELECT version FROM local_schema_migrations LIMIT 1");
    return false;
  } catch {
    return true;
  } finally {
    await database.closeAsync();
  }
}

function encryptedFileDirectory(): Directory {
  return new Directory(Paths.document, encryptedFileDirectoryName);
}

function databaseArtifactsExist(): boolean {
  return databaseArtifactFiles().some((file) => file.exists);
}

function databaseArtifactFiles(): ReadonlyArray<File> {
  return [databaseName, `${databaseName}-wal`, `${databaseName}-shm`].map(
    (name) => new File(sqliteDatabaseDirectoryUri(), name),
  );
}

function sqliteDatabaseDirectoryUri(): string {
  const directory = SQLite.defaultDatabaseDirectory;
  return directory.startsWith("file://") ? directory : `file://${directory}`;
}

function fileKeyName(fileId: string): string {
  return `${fileKeyPrefix}${fileId}`;
}

async function readFileKeyIndex(): Promise<ReadonlyArray<string>> {
  const value = await SecureStore.getItemAsync(fileKeyIndexName, deviceOnlyOptions);
  if (!value) {
    return [];
  }
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
}

async function addFileKeyToIndex(fileId: string): Promise<void> {
  const next = [...new Set([...(await readFileKeyIndex()), fileId])];
  await SecureStore.setItemAsync(fileKeyIndexName, JSON.stringify(next), deviceOnlyOptions);
}

async function removeFileKeyFromIndex(fileId: string): Promise<void> {
  const next = (await readFileKeyIndex()).filter((item) => item !== fileId);
  if (next.length === 0) {
    await SecureStore.deleteItemAsync(fileKeyIndexName);
    return;
  }
  await SecureStore.setItemAsync(fileKeyIndexName, JSON.stringify(next), deviceOnlyOptions);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function withLocalSecurityStage<T>(stage: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${stage} failed: ${message}`, { cause: error });
  }
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
