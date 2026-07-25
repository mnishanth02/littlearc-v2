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
import { createLocalSecuritySessionCache } from "./session";

const databaseName = "littlearc-local-v1.db";
const databaseKeyName = "littlearc.local-security.database-key.v1";
const enrollmentMarkerName = "littlearc.local-security.enrollment.v1";
const fileKeyIndexName = "littlearc.local-security.file-key-index.v1";
const fileKeyPrefix = "littlearc.local-security.file-key.v1.";
const encryptedFileDirectoryName = "littlearc-encrypted-files-v1";
const fileKeyWrappingDerivationPrefix = "littlearc-local-file-key-wrapping:v1:";
const fileKeyWrappingAadPrefix = "littlearc-local-file-key:v1:";

const deviceOnlyOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;
const protectedOptions = {
  ...deviceOnlyOptions,
  authenticationPrompt: "Unlock LittleArc local data",
  requireAuthentication: true,
} as const;

type LocalSecuritySession = {
  readonly databaseKey: string;
  readonly fileKeyWrappingKey: Crypto.AESEncryptionKey;
};

const localSecuritySession = createLocalSecuritySessionCache<LocalSecuritySession>();

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
  lockLocalSecuritySession();
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
    await localSecuritySession.getOrUnlock(() => createLocalSecuritySession(databaseKey));
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
  lockLocalSecuritySession();
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
  await localSecuritySession.getOrUnlock(() => createLocalSecuritySession(databaseKey));

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
  const session = await localSecuritySession.getOrUnlock(unlockLocalSecuritySession);
  const database = await openEncryptedDatabase(session.databaseKey);
  try {
    await requireCipher(database);
    await applyLocalMigrations(database);
    await database.execAsync("PRAGMA foreign_keys = ON;");
    return await task(database);
  } finally {
    await database.closeAsync();
  }
}

export function lockLocalSecuritySession(): void {
  localSecuritySession.lock();
  const previewDirectory = localPreviewDirectory();
  if (previewDirectory.exists) {
    previewDirectory.delete();
  }
}

export type EncryptedLocalFile = {
  readonly aad: string;
  readonly ciphertextBytes: number;
  readonly fileId: string;
  readonly opaqueName: string;
};

export async function storeEncryptedLocalFile(
  database: SQLite.SQLiteDatabase,
  input: {
    readonly fileId: string;
    readonly plaintextUri: string;
    readonly purpose: "capture-normalized" | "capture-original" | "capture-thumbnail";
  },
): Promise<EncryptedLocalFile> {
  const source = new File(input.plaintextUri);
  if (!source.exists || source.size <= 0) {
    throw new Error("The staged local file is unavailable.");
  }
  const opaqueName = `${input.fileId}.lac`;
  const aad = `littlearc-local-file:v1:${input.fileId}:${input.purpose}`;
  const directory = encryptedFileDirectory();
  const destination = new File(directory, opaqueName);
  const key = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
  const encodedKey = await key.encoded("base64");
  let metadataInserted = false;
  try {
    const sealed = await Crypto.aesEncryptAsync(await source.bytes(), key, {
      additionalData: new TextEncoder().encode(aad),
      nonce: { length: 12 },
      tagLength: 16,
    });
    const combined = await sealed.combined("bytes");
    if (typeof combined === "string") {
      throw new Error("The encrypted local-file primitive returned an unexpected encoding.");
    }
    directory.create({ idempotent: true, intermediates: true });
    destination.create({ overwrite: false });
    destination.write(combined);
    const wrappedKey = await wrapLocalFileKey(input.fileId, encodedKey);
    await database.runAsync(
      `INSERT INTO local_encrypted_files (
        file_id, opaque_name, aad, ciphertext_bytes, created_at, wrapped_key
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      input.fileId,
      opaqueName,
      aad,
      combined.length,
      new Date().toISOString(),
      wrappedKey,
    );
    metadataInserted = true;
    return {
      aad,
      ciphertextBytes: combined.length,
      fileId: input.fileId,
      opaqueName,
    };
  } catch (error) {
    if (metadataInserted) {
      await database.runAsync("DELETE FROM local_encrypted_files WHERE file_id = ?", input.fileId);
    }
    if (destination.exists) {
      destination.delete();
    }
    throw error;
  }
}

export async function openEncryptedLocalFilePreview(
  database: SQLite.SQLiteDatabase,
  input: {
    readonly extension: "jpg" | "pdf";
    readonly fileId: string;
  },
): Promise<string> {
  const metadata = await database.getFirstAsync<{
    readonly aad: string;
    readonly opaqueName: string;
    readonly wrappedKey: string | null;
  }>(
    `SELECT aad, opaque_name AS "opaqueName", wrapped_key AS "wrappedKey"
     FROM local_encrypted_files WHERE file_id = ?`,
    input.fileId,
  );
  if (!metadata) {
    throw new Error("The encrypted local file is unavailable.");
  }
  const keyValue = metadata.wrappedKey
    ? await unwrapLocalFileKey(input.fileId, metadata.wrappedKey)
    : await migrateLegacyLocalFileKey(database, input.fileId);
  if (!keyValue) {
    throw new Error("The protected local-file key is unavailable.");
  }
  const source = new File(encryptedFileDirectory(), metadata.opaqueName);
  if (!source.exists) {
    throw new Error("The encrypted local-file ciphertext is unavailable.");
  }
  const key = await Crypto.AESEncryptionKey.import(keyValue, "base64");
  const opened = await Crypto.aesDecryptAsync(
    Crypto.AESSealedData.fromCombined(await source.bytes()),
    key,
    {
      additionalData: new TextEncoder().encode(metadata.aad),
      output: "bytes",
    },
  );
  if (typeof opened === "string") {
    throw new Error("The encrypted local-file primitive returned an unexpected encoding.");
  }
  const directory = localPreviewDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const preview = new File(directory, `${input.fileId}.${input.extension}`);
  if (preview.exists) {
    preview.delete();
  }
  preview.create({ overwrite: false });
  preview.write(opened);
  return preview.uri;
}

export function removeLocalFilePreview(uri: string): void {
  const preview = new File(uri);
  if (preview.exists) {
    preview.delete();
  }
}

export async function deleteEncryptedLocalFile(
  database: SQLite.SQLiteDatabase,
  fileId: string,
): Promise<void> {
  await deleteEncryptedLocalFileMaterial(database, fileId);
  await deleteEncryptedLocalFileMetadata(database, fileId);
}

export async function deleteEncryptedLocalFileMaterial(
  database: SQLite.SQLiteDatabase,
  fileId: string,
): Promise<void> {
  const metadata = await database.getFirstAsync<{ readonly opaqueName: string }>(
    `SELECT opaque_name AS "opaqueName"
     FROM local_encrypted_files WHERE file_id = ?`,
    fileId,
  );
  if (metadata) {
    const ciphertext = new File(encryptedFileDirectory(), metadata.opaqueName);
    if (ciphertext.exists) {
      ciphertext.delete();
    }
  }
  await deleteLegacyLocalFileKey(fileId);
}

export async function deleteEncryptedLocalFileMetadata(
  database: SQLite.SQLiteDatabase,
  fileId: string,
): Promise<void> {
  await database.runAsync("DELETE FROM local_encrypted_files WHERE file_id = ?", fileId);
}

export async function simulateProtectedKeyInvalidationForValidation(): Promise<void> {
  if (!__DEV__) {
    throw new Error("Synthetic key invalidation is development-only.");
  }
  lockLocalSecuritySession();
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
  lockLocalSecuritySession();
  const fileIds = await readFileKeyIndex();
  await Promise.all(fileIds.map((fileId) => SecureStore.deleteItemAsync(fileKeyName(fileId))));
  const directory = encryptedFileDirectory();
  if (directory.exists) {
    directory.delete();
  }
  const previewDirectory = localPreviewDirectory();
  if (previewDirectory.exists) {
    previewDirectory.delete();
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
    !localPreviewDirectory().exists &&
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
    const wrappedKey = await wrapLocalFileKey(fileId, encodedKey);
    await database.runAsync(
      `INSERT INTO local_encrypted_files (
        file_id, opaque_name, aad, ciphertext_bytes, created_at, wrapped_key
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      fileId,
      opaqueName,
      aad,
      combined.length,
      new Date().toISOString(),
      wrappedKey,
    );
    metadataInserted = true;
    let fileKeyWrongAadRejected = false;
    try {
      await unwrapLocalFileKey(`${fileId}:wrong`, wrappedKey);
    } catch {
      fileKeyWrongAadRejected = true;
    }
    if (!fileKeyWrongAadRejected) {
      throw new Error("The local-file key envelope accepted modified authentication data.");
    }
    const storedKey = await unwrapLocalFileKey(fileId, wrappedKey);
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
  }
}

async function unlockLocalSecuritySession(): Promise<LocalSecuritySession> {
  const markerValue = await SecureStore.getItemAsync(enrollmentMarkerName, deviceOnlyOptions);
  if (!markerValue) {
    throw new Error("This installation is not enrolled.");
  }
  parseLocalEnrollmentMarker(markerValue);
  const databaseKey = await SecureStore.getItemAsync(databaseKeyName, protectedOptions);
  if (!databaseKey) {
    throw new Error("Account reauthentication is required before synchronization.");
  }
  return createLocalSecuritySession(databaseKey);
}

async function createLocalSecuritySession(databaseKey: string): Promise<LocalSecuritySession> {
  if (!/^[0-9a-f]{64}$/.test(databaseKey)) {
    throw new Error("The local database key has an invalid shape.");
  }
  const fileKeyWrappingKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${fileKeyWrappingDerivationPrefix}${databaseKey}`,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return {
    databaseKey,
    fileKeyWrappingKey: await Crypto.AESEncryptionKey.import(fileKeyWrappingKey, "hex"),
  };
}

async function wrapLocalFileKey(fileId: string, encodedKey: string): Promise<string> {
  const session = localSecuritySession.current();
  if (!session) {
    throw new Error("The protected local-security session is locked.");
  }
  const sealed = await Crypto.aesEncryptAsync(
    new TextEncoder().encode(encodedKey),
    session.fileKeyWrappingKey,
    {
      additionalData: new TextEncoder().encode(`${fileKeyWrappingAadPrefix}${fileId}`),
      nonce: { length: 12 },
      tagLength: 16,
    },
  );
  const wrapped = await sealed.combined("base64");
  if (typeof wrapped !== "string") {
    throw new Error("The local-file key envelope returned an unexpected encoding.");
  }
  return wrapped;
}

async function unwrapLocalFileKey(fileId: string, wrappedKey: string): Promise<string> {
  const session = localSecuritySession.current();
  if (!session) {
    throw new Error("The protected local-security session is locked.");
  }
  const opened = await Crypto.aesDecryptAsync(
    Crypto.AESSealedData.fromCombined(
      Uint8Array.from(atob(wrappedKey), (character) => character.charCodeAt(0)),
    ),
    session.fileKeyWrappingKey,
    {
      additionalData: new TextEncoder().encode(`${fileKeyWrappingAadPrefix}${fileId}`),
      output: "bytes",
    },
  );
  if (typeof opened === "string") {
    throw new Error("The local-file key envelope returned an unexpected encoding.");
  }
  return new TextDecoder().decode(opened);
}

async function migrateLegacyLocalFileKey(
  database: SQLite.SQLiteDatabase,
  fileId: string,
): Promise<string> {
  const legacyKey = await SecureStore.getItemAsync(fileKeyName(fileId), protectedOptions);
  if (!legacyKey) {
    throw new Error("The protected local-file key is unavailable.");
  }
  const wrappedKey = await wrapLocalFileKey(fileId, legacyKey);
  await database.runAsync(
    "UPDATE local_encrypted_files SET wrapped_key = ? WHERE file_id = ?",
    wrappedKey,
    fileId,
  );
  await deleteLegacyLocalFileKey(fileId);
  return legacyKey;
}

async function deleteLegacyLocalFileKey(fileId: string): Promise<void> {
  await SecureStore.deleteItemAsync(fileKeyName(fileId));
  await removeFileKeyFromIndex(fileId);
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

function localPreviewDirectory(): Directory {
  return new Directory(Paths.cache, "littlearc-local-previews-v1");
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
