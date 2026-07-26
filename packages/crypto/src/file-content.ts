import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

const keyBytes = 32;
const nonceBytes = 12;
const tagBytes = 16;

export type FileContentDecryptionInput = {
  readonly aad: string;
  readonly authTag: Buffer;
  readonly ciphertext: Readable;
  readonly fileKey: Buffer;
  readonly nonce: Buffer;
  readonly plaintext: Writable;
  readonly signal?: AbortSignal;
};

export type FileContentEncryptionInput = {
  readonly aad: string;
  readonly fileKey: Buffer;
  readonly nonce?: Buffer;
  readonly plaintext: Readable;
  readonly ciphertext: Writable;
  readonly signal?: AbortSignal;
};

export async function decryptFileContent(input: FileContentDecryptionInput): Promise<void> {
  assertBytes(input.fileKey, keyBytes, "fileKey");
  assertBytes(input.nonce, nonceBytes, "nonce");
  assertBytes(input.authTag, tagBytes, "authTag");
  const key = Buffer.from(input.fileKey);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, input.nonce);
    decipher.setAAD(Buffer.from(input.aad, "utf8"));
    decipher.setAuthTag(input.authTag);
    await pipeline(input.ciphertext, decipher, input.plaintext, {
      ...(input.signal ? { signal: input.signal } : {}),
    });
  } finally {
    key.fill(0);
  }
}

export async function encryptFileContent(
  input: FileContentEncryptionInput,
): Promise<{ readonly authTag: Buffer; readonly nonce: Buffer }> {
  assertBytes(input.fileKey, keyBytes, "fileKey");
  const nonce = input.nonce ? Buffer.from(input.nonce) : randomBytes(nonceBytes);
  assertBytes(nonce, nonceBytes, "nonce");
  const key = Buffer.from(input.fileKey);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(Buffer.from(input.aad, "utf8"));
    await pipeline(input.plaintext, cipher, input.ciphertext, {
      ...(input.signal ? { signal: input.signal } : {}),
    });
    return { authTag: cipher.getAuthTag(), nonce };
  } finally {
    key.fill(0);
  }
}

function assertBytes(value: Buffer, expected: number, name: string): void {
  if (value.length !== expected) {
    throw new Error(`${name} must be exactly ${expected} bytes.`);
  }
}
