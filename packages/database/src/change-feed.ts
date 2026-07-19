import { type Cursor, parseCursor } from "@littlearc/domain";

export type ChangeFeedCursorPayload = {
  readonly version: 1;
  readonly sequence: number;
};

export function createChangeFeedCursor(sequence: number): Cursor {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("Change-feed sequence must be a non-negative safe integer.");
  }

  return parseCursor(
    Buffer.from(
      JSON.stringify({ sequence, version: 1 } satisfies ChangeFeedCursorPayload),
    ).toString("base64url"),
    "cursor",
  );
}

export function parseChangeFeedCursor(cursor: Cursor): ChangeFeedCursorPayload {
  let decoded: unknown;

  try {
    decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new Error("Change-feed cursor payload is invalid.");
  }

  if (
    !decoded ||
    typeof decoded !== "object" ||
    (decoded as ChangeFeedCursorPayload).version !== 1 ||
    !Number.isSafeInteger((decoded as ChangeFeedCursorPayload).sequence) ||
    (decoded as ChangeFeedCursorPayload).sequence < 0
  ) {
    throw new Error("Change-feed cursor payload is invalid.");
  }

  return decoded as ChangeFeedCursorPayload;
}
