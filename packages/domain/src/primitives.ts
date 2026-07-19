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
