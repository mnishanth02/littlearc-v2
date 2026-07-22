import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { type Cursor, parseCursor } from "@littlearc/domain";

export type ChangeFeedCursorPayload = {
  readonly kind: "changes";
  readonly sequence: number;
  readonly version: 1;
};

export type SnapshotCursorPayload = {
  readonly afterId: string | null;
  readonly kind: "snapshot";
  readonly sequence: number;
  readonly version: 1;
};

export type SyncCursorPayload = ChangeFeedCursorPayload | SnapshotCursorPayload;

export type SyncCursorCodec = {
  readonly createChangesCursor: (sequence: number) => Cursor;
  readonly createSnapshotCursor: (input: {
    readonly afterId: string | null;
    readonly sequence: number;
  }) => Cursor;
  readonly parseChangesCursor: (cursor: Cursor) => ChangeFeedCursorPayload;
  readonly parseSnapshotCursor: (cursor: Cursor) => SnapshotCursorPayload;
};

export function createSyncCursorCodec(keyMaterial: Buffer): SyncCursorCodec {
  if (keyMaterial.length !== 32) {
    throw new Error("Sync cursor key material must contain 32 bytes.");
  }
  const signingKey = Buffer.from(
    hkdfSync("sha256", keyMaterial, Buffer.alloc(0), "littlearc-sync-cursor-v1", 32),
  );

  function create(payload: SyncCursorPayload): Cursor {
    assertSequence(payload.sequence);
    if (payload.kind === "snapshot" && payload.afterId !== null && !isUuidV7(payload.afterId)) {
      throw new Error("Snapshot cursor afterId must be a UUIDv7 or null.");
    }
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = sign(encodedPayload, signingKey).toString("base64url");
    return parseCursor(
      Buffer.from(JSON.stringify({ payload: encodedPayload, signature }), "utf8").toString(
        "base64url",
      ),
      "cursor",
    );
  }

  function parse(cursor: Cursor, expectedKind: SyncCursorPayload["kind"]): SyncCursorPayload {
    let envelope: unknown;
    try {
      envelope = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    } catch {
      throw invalidCursor();
    }
    if (
      !envelope ||
      typeof envelope !== "object" ||
      Array.isArray(envelope) ||
      typeof (envelope as { payload?: unknown }).payload !== "string" ||
      typeof (envelope as { signature?: unknown }).signature !== "string"
    ) {
      throw invalidCursor();
    }
    const encodedPayload = (envelope as { payload: string }).payload;
    const suppliedSignature = decodeBase64Url(
      (envelope as { signature: string }).signature,
      "signature",
    );
    const expectedSignature = sign(encodedPayload, signingKey);
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      throw invalidCursor();
    }
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
    } catch {
      throw invalidCursor();
    }
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      (payload as Partial<SyncCursorPayload>).version !== 1 ||
      (payload as Partial<SyncCursorPayload>).kind !== expectedKind
    ) {
      throw invalidCursor();
    }
    const candidate = payload as SyncCursorPayload;
    assertSequence(candidate.sequence);
    if (
      candidate.kind === "snapshot" &&
      candidate.afterId !== null &&
      !isUuidV7(candidate.afterId)
    ) {
      throw invalidCursor();
    }
    return candidate;
  }

  return {
    createChangesCursor(sequence) {
      return create({ kind: "changes", sequence, version: 1 });
    },
    createSnapshotCursor(input) {
      return create({
        afterId: input.afterId,
        kind: "snapshot",
        sequence: input.sequence,
        version: 1,
      });
    },
    parseChangesCursor(cursor) {
      return parse(cursor, "changes") as ChangeFeedCursorPayload;
    },
    parseSnapshotCursor(cursor) {
      return parse(cursor, "snapshot") as SnapshotCursorPayload;
    },
  };
}

function sign(payload: string, key: Buffer): Buffer {
  return createHmac("sha256", key).update(payload, "utf8").digest();
}

function decodeBase64Url(value: string, field: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Sync cursor ${field} is invalid.`);
  }
  return Buffer.from(value, "base64url");
}

function assertSequence(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Change-feed sequence must be a non-negative safe integer.");
  }
}

function invalidCursor(): Error {
  return new Error("Sync cursor is invalid or has been modified.");
}

function isUuidV7(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
