import { describe, expect, it } from "vitest";
import {
  createUtcTimestamp,
  createUuidV7,
  DomainValidationError,
  initialRevision,
  nextRevision,
  parseCursor,
  parseIdempotencyKey,
  parseRevision,
  parseUtcTimestamp,
  parseUuidV7,
} from "./index.js";

const validUuidV7 = "019f742b-de82-7292-86cd-5475a1388313";

describe("domain primitives", () => {
  it("accepts normalized UUIDv7 identifiers", () => {
    expect(parseUuidV7(validUuidV7)).toBe(validUuidV7);
    expect(parseUuidV7(validUuidV7.toUpperCase())).toBe(validUuidV7);
    expect(parseIdempotencyKey(validUuidV7)).toBe(validUuidV7);
  });

  it("rejects non-v7 UUIDs and malformed idempotency keys", () => {
    expect(() => parseUuidV7("019f742b-de82-4292-86cd-5475a1388313")).toThrow(
      DomainValidationError,
    );
    expect(() => parseIdempotencyKey("retry-key")).toThrow(DomainValidationError);
  });

  it.each(["\n", "\r\n"])("rejects a %j suffix on shared string primitives", (suffix) => {
    expect(() => parseUuidV7(`${validUuidV7}${suffix}`)).toThrow(DomainValidationError);
    expect(() => parseUtcTimestamp(`2026-07-19T12:30:15.000Z${suffix}`)).toThrow(
      DomainValidationError,
    );
    expect(() => parseCursor(`cursor_019f742b${suffix}`)).toThrow(DomainValidationError);
  });

  it("accepts normalized UTC timestamps and rejects ambiguous offsets", () => {
    expect(parseUtcTimestamp("2026-07-19T12:30:15.000Z")).toBe("2026-07-19T12:30:15.000Z");
    expect(createUtcTimestamp(new Date("2026-07-19T12:30:15.000Z"))).toBe(
      "2026-07-19T12:30:15.000Z",
    );
    expect(() => parseUtcTimestamp("2026-07-19T12:30:15+05:30")).toThrow(DomainValidationError);
  });

  it("increments positive integer revisions", () => {
    const first = initialRevision();

    expect(first).toBe(1);
    expect(nextRevision(first)).toBe(2);
    expect(() => parseRevision(0)).toThrow(DomainValidationError);
    expect(() => parseRevision(1.5)).toThrow(DomainValidationError);
  });

  it("treats cursors as opaque base64url tokens", () => {
    expect(parseCursor("cursor_019f742b")).toBe("cursor_019f742b");
    expect(() => parseCursor("short")).toThrow(DomainValidationError);
  });

  it("creates UUIDv7 identifiers from injected entropy and time", () => {
    const id = createUuidV7(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 1_721_390_400_000);

    expect(parseUuidV7(id)).toBe(id);
    expect(id.slice(14, 15)).toBe("7");
    expect(["8", "9", "a", "b"]).toContain(id.slice(19, 20));
    expect(() => createUuidV7(new Uint8Array(9))).toThrow(DomainValidationError);
  });
});
