type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export class DomainValidationError extends Error {
  readonly code = "domain_validation_failed";
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "DomainValidationError";
    this.field = field;
  }
}

export type UuidV7 = Brand<string, "UuidV7">;
export type UtcTimestamp = Brand<string, "UtcTimestamp">;
export type Revision = Brand<number, "Revision">;
export type Cursor = Brand<string, "Cursor">;
export type IdempotencyKey = Brand<string, "IdempotencyKey">;
export type MutationId = Brand<string, "MutationId">;

export const uuidV7Pattern =
  "^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-7[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$(?![\\s\\S])";
export const utcTimestampPattern =
  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$(?![\\s\\S])";
export const cursorPattern = "^[A-Za-z0-9_-]{12,512}$(?![\\s\\S])";

const uuidV7Regex = new RegExp(uuidV7Pattern);
const utcTimestampRegex = new RegExp(utcTimestampPattern);
const cursorRegex = new RegExp(cursorPattern);

function validationError(field: string, expectation: string): DomainValidationError {
  return new DomainValidationError(field, `${field} must be ${expectation}.`);
}

export function parseUuidV7(value: string, field = "id"): UuidV7 {
  if (!uuidV7Regex.test(value)) {
    throw validationError(field, "a UUIDv7 string");
  }

  return value.toLowerCase() as UuidV7;
}

export function parseMutationId(value: string, field = "mutationId"): MutationId {
  return parseUuidV7(value, field) as unknown as MutationId;
}

export function parseIdempotencyKey(value: string, field = "Idempotency-Key"): IdempotencyKey {
  return parseUuidV7(value, field) as unknown as IdempotencyKey;
}

export function createUtcTimestamp(date = new Date()): UtcTimestamp {
  return parseUtcTimestamp(date.toISOString());
}

export function parseUtcTimestamp(value: string, field = "timestamp"): UtcTimestamp {
  if (!utcTimestampRegex.test(value)) {
    throw validationError(field, "a normalized UTC ISO 8601 timestamp");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw validationError(field, "a valid normalized UTC ISO 8601 timestamp");
  }

  return value as UtcTimestamp;
}

export function parseRevision(value: number, field = "revision"): Revision {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw validationError(field, "a positive safe integer revision");
  }

  return value as Revision;
}

export function initialRevision(): Revision {
  return parseRevision(1);
}

export function nextRevision(current: Revision): Revision {
  return parseRevision(current + 1);
}

export function parseCursor(value: string, field = "cursor"): Cursor {
  if (!cursorRegex.test(value)) {
    throw validationError(field, "an opaque base64url cursor between 12 and 512 characters");
  }

  return value as Cursor;
}

export function createUuidV7(randomBytes: Uint8Array, timestampMilliseconds = Date.now()): UuidV7 {
  if (randomBytes.length !== 10) {
    throw validationError("randomBytes", "exactly 10 cryptographically random bytes");
  }
  if (
    !Number.isSafeInteger(timestampMilliseconds) ||
    timestampMilliseconds < 0 ||
    timestampMilliseconds > 0xffff_ffff_ffff
  ) {
    throw validationError("timestampMilliseconds", "a non-negative 48-bit integer");
  }

  const bytes = new Uint8Array(16);
  let timestamp = timestampMilliseconds;
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = timestamp & 0xff;
    timestamp = Math.floor(timestamp / 256);
  }
  bytes.set(randomBytes, 6);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return parseUuidV7(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
  );
}
