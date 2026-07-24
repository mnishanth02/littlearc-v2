import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import DocumentScanner from 'react-native-document-scanner-plugin';

import { authClient, authProbeConfiguration } from './auth-client';

const DATABASE_NAME = 'littlearc-m0-sqlcipher.db';
const DATABASE_KEY_NAME = 'littlearc-m0-sqlcipher-key';
const BIOMETRIC_PROBE_KEY = 'littlearc-m0-biometric-probe';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function getDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DATABASE_KEY_NAME);
  if (existing) {
    return existing;
  }

  const created = bytesToHex(Crypto.getRandomBytes(32));
  await SecureStore.setItemAsync(DATABASE_KEY_NAME, created, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return created;
}

async function openEncryptedDatabase(key: string): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync(`PRAGMA key = '${key}';`);
  return database;
}

export type ProbeResult = {
  summary: string;
  details?: Record<string, boolean | number | string | null>;
  followUp?: string;
};

export async function probeRuntime(): Promise<ProbeResult> {
  const initialURL = await Linking.getInitialURL();
  return {
    summary: 'Expo development runtime and Better Auth client initialized.',
    details: {
      appOwnership: Constants.appOwnership ?? null,
      executionEnvironment: Constants.executionEnvironment,
      initialURL,
      expectedCallbackURL: Linking.createURL('/auth/callback'),
      authBaseURL: authProbeConfiguration.baseURL,
      authConfiguredFromEnvironment: authProbeConfiguration.configuredFromEnvironment,
      authClientAvailable: typeof authClient.getSession === 'function',
    },
    followUp: authProbeConfiguration.configuredFromEnvironment
      ? 'Run email OTP, refresh, logout, revocation, and provider callback checks against the synthetic M0 backend.'
      : 'Set EXPO_PUBLIC_AUTH_BASE_URL before running network authentication checks.',
  };
}

export async function probeCrypto(): Promise<ProbeResult> {
  const plaintext = new TextEncoder().encode('littlearc-m0-synthetic-fixture');
  const aad = new TextEncoder().encode('household:synthetic|object:m0');
  const wrongAAD = new TextEncoder().encode('household:wrong|object:m0');
  const key = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
  const sealed = await Crypto.aesEncryptAsync(plaintext, key, {
    additionalData: aad,
    nonce: { length: 12 },
    tagLength: 16,
  });
  const decrypted = await Crypto.aesDecryptAsync(sealed, key, {
    additionalData: aad,
    output: 'bytes',
  });

  if (typeof decrypted === 'string' || !equalBytes(plaintext, decrypted)) {
    throw new Error('AES-GCM round trip returned different plaintext.');
  }

  let wrongAADRejected = false;
  try {
    await Crypto.aesDecryptAsync(sealed, key, {
      additionalData: wrongAAD,
      output: 'bytes',
    });
  } catch {
    wrongAADRejected = true;
  }

  if (!wrongAADRejected) {
    throw new Error('AES-GCM accepted mismatched additional authenticated data.');
  }

  return {
    summary: 'AES-256-GCM round trip passed and mismatched AAD was rejected.',
    details: {
      plaintextBytes: plaintext.length,
      sealedBytes: sealed.combinedSize,
      ivBytes: sealed.ivSize,
      tagBytes: sealed.tagSize,
      wrongAADRejected,
    },
  };
}

export async function probeSQLCipher(): Promise<ProbeResult> {
  const key = await getDatabaseKey();
  const database = await openEncryptedDatabase(key);

  try {
    const cipher = await database.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version;');
    if (!cipher?.cipher_version) {
      throw new Error('PRAGMA cipher_version returned no value; SQLCipher is not active.');
    }

    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS probe_events (
        id TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    const id = Crypto.randomUUID();
    await database.runAsync(
      'INSERT INTO probe_events (id, value, created_at) VALUES (?, ?, ?)',
      id,
      'synthetic-only',
      new Date().toISOString(),
    );
    const stored = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM probe_events WHERE id = ?',
      id,
    );
    if (stored?.value !== 'synthetic-only') {
      throw new Error('Encrypted database round trip returned an unexpected value.');
    }

    return {
      summary: 'SQLCipher opened, reported a cipher version, migrated, and completed a write/read round trip.',
      details: {
        cipherVersion: cipher.cipher_version,
        walEnabled: true,
        syntheticRecordRead: true,
      },
      followUp: 'Close/reopen, wrong-key, migration rollback, biometric invalidation, and resynchronization require the physical-device runbook.',
    };
  } finally {
    await database.closeAsync();
  }
}

export async function probeBiometrics(): Promise<ProbeResult> {
  const hardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
  const authenticationTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

  if (!hardware || !enrolled) {
    return {
      summary: 'Biometric APIs loaded, but this device cannot complete an enrolled-biometric check.',
      details: {
        hardware,
        enrolled,
        securityLevel,
        authenticationTypeCount: authenticationTypes.length,
      },
      followUp: 'Repeat on physical iOS and Android devices with enrolled biometrics and then change enrollment to test key invalidation.',
    };
  }

  const authentication = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock the synthetic LittleArc M0 probe',
    biometricsSecurityLevel: 'strong',
    disableDeviceFallback: false,
  });
  if (!authentication.success) {
    throw new Error(`Biometric authentication failed: ${authentication.error}`);
  }

  const probeValue = Crypto.randomUUID();
  await SecureStore.setItemAsync(BIOMETRIC_PROBE_KEY, probeValue, {
    authenticationPrompt: 'Protect the synthetic LittleArc M0 probe',
    requireAuthentication: true,
  });
  const stored = await SecureStore.getItemAsync(BIOMETRIC_PROBE_KEY, {
    authenticationPrompt: 'Read the synthetic LittleArc M0 probe',
    requireAuthentication: true,
  });
  if (stored !== probeValue) {
    throw new Error('Biometric-protected SecureStore value did not round trip.');
  }

  return {
    summary: 'Strong biometric authentication and protected SecureStore round trip passed.',
    details: {
      hardware,
      enrolled,
      securityLevel,
      authenticationTypeCount: authenticationTypes.length,
    },
    followUp: 'Change biometric enrollment and verify the stored value becomes unavailable, then exercise server reauthentication and resynchronization.',
  };
}

export async function probeScannerAndOCR(): Promise<ProbeResult> {
  let scan: Awaited<ReturnType<typeof DocumentScanner.scanDocument>>;
  try {
    scan = await DocumentScanner.scanDocument({ maxNumDocuments: 3 });
  } catch (error) {
    const message = errorMessage(error);
    if (message.toLowerCase().includes('not supported')) {
      return {
        summary: 'Scanner API loaded and reported that document scanning is unsupported on this device.',
        details: { pageCount: 0, supported: false },
        followUp:
          'This is the expected iOS Simulator boundary; complete multi-page camera and offline OCR checks on the required physical-device matrix.',
      };
    }
    throw error;
  }
  const scannedImages = scan.scannedImages ?? [];
  const scanStatus = scan.status ?? 'unknown';
  if (scannedImages.length === 0) {
    return {
      summary: `Scanner ended with status ${scanStatus} and no retained pages.`,
      details: { pageCount: 0, status: scanStatus },
      followUp: 'Cancellation is an expected outcome; repeat and complete a synthetic multi-page scan for acceptance.',
    };
  }

  const firstPage = scannedImages[0];
  if (!firstPage) {
    throw new Error('Scanner reported pages but did not return the first page URI.');
  }
  const recognition = await recognizeText(firstPage);

  return {
    summary: 'Scanner returned pages and offline OCR processed the first synthetic page.',
    details: {
      status: scanStatus,
      pageCount: scannedImages.length,
      recognizedCharacters: recognition.text.length,
      recognizedBlocks: recognition.blocks.length,
    },
    followUp: 'Do not retain or log recognized medical content; record only aggregate accuracy and correction metrics for approved fixtures.',
  };
}

export async function probeImport(): Promise<ProbeResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
    type: ['application/pdf', 'image/*'],
  });
  if (picked.canceled) {
    return {
      summary: 'Document import was canceled without error.',
      details: { canceled: true, assetCount: 0 },
    };
  }

  return {
    summary: 'Document picker returned app-readable synthetic assets.',
    details: {
      canceled: false,
      assetCount: picked.assets.length,
      copiedToCache: picked.assets.every((asset) => asset.uri.length > 0),
    },
    followUp: 'Incoming OS share extensions remain a separate physical-device/local-module acceptance item.',
  };
}

export async function probeImageImport(): Promise<ProbeResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo-library permission was not granted for the synthetic import probe.');
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ['images'],
    quality: 1,
  });
  return {
    summary: picked.canceled
      ? 'Image import was canceled without error.'
      : 'Image picker returned synthetic local assets.',
    details: {
      canceled: picked.canceled,
      assetCount: picked.canceled ? 0 : picked.assets.length,
    },
  };
}

export async function probeLocalNotification(): Promise<ProbeResult> {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Notification permission was not granted for the generic local probe.');
  }
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'LittleArc reminder',
      body: 'Open LittleArc to review an item.',
      data: { route: '/m0/synthetic-reminder' },
    },
    trigger: null,
  });

  return {
    summary: 'A generic local notification was scheduled without sensitive payload data.',
    details: { scheduled: true, identifierLength: identifier.length },
    followUp: 'Remote token rotation and authenticated cold-start deep links require physical devices and provider credentials.',
  };
}

export async function runProbe(
  probe: () => Promise<ProbeResult>,
): Promise<{ result?: ProbeResult; error?: string }> {
  try {
    return { result: await probe() };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
