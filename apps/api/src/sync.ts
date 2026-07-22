import type {
  ChildProfileSyncMutation,
  SyncCursorCodec,
  SyncMutationOutcome,
  SyncPersistence,
} from "@littlearc/database";
import { parseCursor, type UuidV7 } from "@littlearc/domain";

export type SyncService = {
  readonly pull: (input: {
    readonly cursor?: string;
    readonly identityUserId: string;
    readonly limit: number;
  }) => Promise<
    | {
        readonly changes: Awaited<ReturnType<SyncPersistence["pull"]>>["changes"];
        readonly hasMore: boolean;
        readonly kind: "changes";
        readonly nextCursor: string;
        readonly serverTime: string;
      }
    | {
        readonly kind: "resetRequired";
        readonly reason: "cursorExpired" | "initialSync";
        readonly serverTime: string;
      }
  >;
  readonly push: (input: {
    readonly identityUserId: string;
    readonly mutations: ReadonlyArray<ChildProfileSyncMutation>;
  }) => Promise<{
    readonly results: ReadonlyArray<SyncMutationOutcome>;
    readonly serverTime: string;
  }>;
  readonly snapshot: (input: {
    readonly cursor?: string;
    readonly identityUserId: string;
    readonly limit: number;
  }) => Promise<{
    readonly capturedCursor: string;
    readonly hasMore: boolean;
    readonly items: Awaited<ReturnType<SyncPersistence["snapshot"]>>["items"];
    readonly nextSnapshotCursor: string | null;
    readonly serverTime: string;
  }>;
};

export function createSyncService(options: {
  readonly cursorCodec: SyncCursorCodec;
  readonly persistence: SyncPersistence;
}): SyncService {
  return {
    async pull(input) {
      const serverTime = new Date().toISOString();
      if (!input.cursor) {
        return { kind: "resetRequired", reason: "initialSync", serverTime };
      }
      const cursor = options.cursorCodec.parseChangesCursor(parseCursor(input.cursor));
      const page = await options.persistence.pull({
        afterSequence: cursor.sequence,
        identityUserId: input.identityUserId,
        limit: input.limit,
      });
      if (page.headSequence > 0 && cursor.sequence < page.minimumSequence - 1) {
        return { kind: "resetRequired", reason: "cursorExpired", serverTime };
      }
      return {
        changes: page.changes,
        hasMore: page.hasMore,
        kind: "changes",
        nextCursor: options.cursorCodec.createChangesCursor(page.nextSequence),
        serverTime,
      };
    },

    async snapshot(input) {
      const parsed = input.cursor
        ? options.cursorCodec.parseSnapshotCursor(parseCursor(input.cursor))
        : undefined;
      const page = await options.persistence.snapshot({
        afterId: (parsed?.afterId as UuidV7 | null | undefined) ?? null,
        capturedSequence: parsed?.sequence ?? null,
        identityUserId: input.identityUserId,
        limit: input.limit,
      });
      return {
        capturedCursor: options.cursorCodec.createChangesCursor(page.capturedSequence),
        hasMore: page.hasMore,
        items: page.items,
        nextSnapshotCursor: page.hasMore
          ? options.cursorCodec.createSnapshotCursor({
              afterId: page.nextAfterId,
              sequence: page.capturedSequence,
            })
          : null,
        serverTime: new Date().toISOString(),
      };
    },

    async push(input) {
      return {
        results: await options.persistence.push(input),
        serverTime: new Date().toISOString(),
      };
    },
  };
}
