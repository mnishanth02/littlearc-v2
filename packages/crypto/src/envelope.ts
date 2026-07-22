import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "AES-256-GCM";
const keyLength = 32;
const nonceLength = 12;
const tagLength = 16;

export type EncryptedEnvelopeV1 = {
  readonly aadSchemaVersion: number;
  readonly algorithm: typeof algorithm;
  readonly authTag: string;
  readonly ciphertext: string;
  readonly contentNonce: string;
  readonly formatVersion: 1;
  readonly keyVersion: number;
  readonly wrapNonce: string;
  readonly wrappedDek: string;
};

export type EnvelopeContext = {
  readonly aadSchemaVersion: number;
  readonly householdId: string;
  readonly objectId: string;
  readonly objectType: "child_profile" | "parent_profile";
};

export type WrappedHouseholdKey = {
  readonly keyVersion: number;
  readonly wrapNonce: Buffer;
  readonly wrappedKey: Buffer;
  readonly wrappingKeyVersion: number;
};

export type StructuredPayloadCrypto = {
  readonly createHouseholdKey: () => {
    readonly plaintextKey: Buffer;
    readonly wrapped: WrappedHouseholdKey;
  };
  readonly decrypt: (
    envelope: EncryptedEnvelopeV1,
    context: EnvelopeContext,
    householdKey: Buffer,
  ) => unknown;
  readonly encrypt: (
    payload: Record<string, unknown>,
    context: EnvelopeContext,
    householdKey: Buffer,
    householdKeyVersion: number,
  ) => EncryptedEnvelopeV1;
  readonly unwrapHouseholdKey: (wrapped: WrappedHouseholdKey) => Buffer;
};

export function createStructuredPayloadCrypto(options: {
  readonly keyEncryptionKey: Buffer;
  readonly wrappingKeyVersion: number;
}): StructuredPayloadCrypto {
  assertKey(options.keyEncryptionKey, "keyEncryptionKey");
  assertPositiveInteger(options.wrappingKeyVersion, "wrappingKeyVersion");

  return {
    createHouseholdKey() {
      const plaintextKey = randomBytes(keyLength);
      const wrapped = wrapKey(
        plaintextKey,
        options.keyEncryptionKey,
        options.wrappingKeyVersion,
        1,
      );
      return { plaintextKey, wrapped };
    },
    decrypt(envelope, context, householdKey) {
      assertEncryptedEnvelopeV1(envelope);
      assertKey(householdKey, "householdKey");
      const wrappedDek = decode(envelope.wrappedDek, "wrappedDek");
      const dek = unwrapKey(
        {
          keyVersion: envelope.keyVersion,
          wrapNonce: decode(envelope.wrapNonce, "wrapNonce"),
          wrappedKey: wrappedDek,
          wrappingKeyVersion: envelope.keyVersion,
        },
        householdKey,
      );
      try {
        const decipher = createDecipheriv(
          "aes-256-gcm",
          dek,
          decode(envelope.contentNonce, "contentNonce"),
          { authTagLength: tagLength },
        );
        decipher.setAAD(aad(context));
        decipher.setAuthTag(decode(envelope.authTag, "authTag"));
        const plaintext = Buffer.concat([
          decipher.update(decode(envelope.ciphertext, "ciphertext")),
          decipher.final(),
        ]);
        return JSON.parse(plaintext.toString("utf8")) as unknown;
      } finally {
        dek.fill(0);
      }
    },
    encrypt(payload, context, householdKey, householdKeyVersion) {
      assertKey(householdKey, "householdKey");
      assertPositiveInteger(householdKeyVersion, "householdKeyVersion");
      const dek = randomBytes(keyLength);
      const contentNonce = randomBytes(nonceLength);
      const cipher = createCipheriv("aes-256-gcm", dek, contentNonce, {
        authTagLength: tagLength,
      });
      cipher.setAAD(aad(context));
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(payload), "utf8"),
        cipher.final(),
      ]);
      const wrappedDek = wrapKey(dek, householdKey, householdKeyVersion, householdKeyVersion);
      dek.fill(0);

      return {
        aadSchemaVersion: context.aadSchemaVersion,
        algorithm,
        authTag: encode(cipher.getAuthTag()),
        ciphertext: encode(ciphertext),
        contentNonce: encode(contentNonce),
        formatVersion: 1,
        keyVersion: householdKeyVersion,
        wrapNonce: encode(wrappedDek.wrapNonce),
        wrappedDek: encode(wrappedDek.wrappedKey),
      };
    },
    unwrapHouseholdKey(wrapped) {
      return unwrapKey(wrapped, options.keyEncryptionKey);
    },
  };
}

export function assertEncryptedEnvelopeV1(value: unknown): asserts value is EncryptedEnvelopeV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Encrypted envelope must be an object.");
  }
  const envelope = value as Partial<EncryptedEnvelopeV1>;
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    "aadSchemaVersion",
    "algorithm",
    "authTag",
    "ciphertext",
    "contentNonce",
    "formatVersion",
    "keyVersion",
    "wrapNonce",
    "wrappedDek",
  ].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new Error("Encrypted envelope keys do not match V1.");
  }
  if (envelope.formatVersion !== 1 || envelope.algorithm !== algorithm) {
    throw new Error("Encrypted envelope version or algorithm is unsupported.");
  }
  assertPositiveInteger(envelope.keyVersion, "keyVersion");
  assertPositiveInteger(envelope.aadSchemaVersion, "aadSchemaVersion");
  if (decode(envelope.wrapNonce, "wrapNonce").length !== nonceLength) {
    throw new Error("wrapNonce must decode to 96 bits.");
  }
  if (decode(envelope.contentNonce, "contentNonce").length !== nonceLength) {
    throw new Error("contentNonce must decode to 96 bits.");
  }
  if (decode(envelope.authTag, "authTag").length !== tagLength) {
    throw new Error("authTag must decode to 128 bits.");
  }
  if (decode(envelope.wrappedDek, "wrappedDek").length !== keyLength + tagLength) {
    throw new Error("wrappedDek has an invalid length.");
  }
  if (decode(envelope.ciphertext, "ciphertext").length === 0) {
    throw new Error("ciphertext must not be empty.");
  }
}

function aad(context: EnvelopeContext): Buffer {
  assertPositiveInteger(context.aadSchemaVersion, "aadSchemaVersion");
  return Buffer.from(
    JSON.stringify({
      aadSchemaVersion: context.aadSchemaVersion,
      formatVersion: 1,
      householdId: context.householdId,
      objectId: context.objectId,
      objectType: context.objectType,
    }),
    "utf8",
  );
}

function wrapKey(
  plaintextKey: Buffer,
  wrappingKey: Buffer,
  wrappingKeyVersion: number,
  keyVersion: number,
): WrappedHouseholdKey {
  const wrapNonce = randomBytes(nonceLength);
  const cipher = createCipheriv("aes-256-gcm", wrappingKey, wrapNonce, {
    authTagLength: tagLength,
  });
  cipher.setAAD(Buffer.from(`littlearc-key-wrap-v1:${keyVersion}`, "utf8"));
  const wrappedKey = Buffer.concat([
    cipher.update(plaintextKey),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return { keyVersion, wrapNonce, wrappedKey, wrappingKeyVersion };
}

function unwrapKey(wrapped: WrappedHouseholdKey, wrappingKey: Buffer): Buffer {
  assertKey(wrappingKey, "wrappingKey");
  const tag = wrapped.wrappedKey.subarray(-tagLength);
  const ciphertext = wrapped.wrappedKey.subarray(0, -tagLength);
  const decipher = createDecipheriv("aes-256-gcm", wrappingKey, wrapped.wrapNonce, {
    authTagLength: tagLength,
  });
  decipher.setAAD(Buffer.from(`littlearc-key-wrap-v1:${wrapped.keyVersion}`, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function assertKey(value: Buffer, field: string): void {
  if (value.length !== keyLength) {
    throw new Error(`${field} must contain 32 bytes.`);
  }
}

function assertPositiveInteger(value: unknown, field: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`${field} must be a positive safe integer.`);
  }
}

function encode(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: unknown, field: string): Buffer {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`${field} must be non-empty base64url.`);
  }
  return Buffer.from(value, "base64url");
}
