import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const keyBytes = 32;
const nonceBytes = 12;
const tagBytes = 16;

export type FileEncryptionContext = {
  readonly aadSchemaVersion: 1;
  readonly format: "application/pdf" | "image/heic" | "image/jpeg" | "image/png";
  readonly householdId: string;
  readonly objectId: string;
  readonly purpose: "capture-original";
};

export type WrappedFileKey = {
  readonly keyVersion: number;
  readonly wrapNonce: Buffer;
  readonly wrappedKey: Buffer;
};

export type FileKeyCrypto = {
  readonly currentKeyVersion: number;
  readonly unwrap: (
    wrapped: WrappedFileKey,
    householdKey: Buffer,
    context: FileEncryptionContext,
  ) => Buffer;
  readonly wrap: (
    plaintextFileKey: Buffer,
    householdKey: Buffer,
    context: FileEncryptionContext,
  ) => WrappedFileKey;
};

export function canonicalFileAad(context: FileEncryptionContext): string {
  if (context.aadSchemaVersion !== 1) {
    throw new Error("File AAD schema version is unsupported.");
  }
  return JSON.stringify({
    aadSchemaVersion: context.aadSchemaVersion,
    format: context.format,
    householdId: context.householdId,
    objectId: context.objectId,
    purpose: context.purpose,
    protocol: "littlearc-file",
  });
}

export function createFileKeyCrypto(options: {
  readonly currentKeyVersion: number;
}): FileKeyCrypto {
  if (!Number.isInteger(options.currentKeyVersion) || options.currentKeyVersion < 1) {
    throw new Error("File-key version must be a positive integer.");
  }

  return {
    currentKeyVersion: options.currentKeyVersion,
    unwrap(wrapped, householdKey, context) {
      assertKey(householdKey, "householdKey");
      const tag = wrapped.wrappedKey.subarray(-tagBytes);
      const ciphertext = wrapped.wrappedKey.subarray(0, -tagBytes);
      const decipher = createDecipheriv("aes-256-gcm", householdKey, wrapped.wrapNonce);
      decipher.setAAD(wrappingAad(context, wrapped.keyVersion));
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      assertKey(plaintext, "unwrappedFileKey");
      return plaintext;
    },
    wrap(plaintextFileKey, householdKey, context) {
      assertKey(plaintextFileKey, "plaintextFileKey");
      assertKey(householdKey, "householdKey");
      const wrapNonce = randomBytes(nonceBytes);
      const cipher = createCipheriv("aes-256-gcm", householdKey, wrapNonce);
      cipher.setAAD(wrappingAad(context, options.currentKeyVersion));
      const wrappedKey = Buffer.concat([
        cipher.update(plaintextFileKey),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
      return { keyVersion: options.currentKeyVersion, wrapNonce, wrappedKey };
    },
  };
}

function wrappingAad(context: FileEncryptionContext, keyVersion: number): Buffer {
  return Buffer.from(
    `littlearc-file-key-wrap:v1:${keyVersion}:${canonicalFileAad(context)}`,
    "utf8",
  );
}

function assertKey(value: Buffer, name: string): void {
  if (value.length !== keyBytes) {
    throw new Error(`${name} must be exactly ${keyBytes} bytes.`);
  }
}
