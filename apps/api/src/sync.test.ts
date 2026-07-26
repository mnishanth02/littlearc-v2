import { createSyncCursorCodec, type SyncPersistence } from "@littlearc/database";
import { parseUuidV7 } from "@littlearc/domain";
import { describe, expect, it, vi } from "vitest";
import { createSyncService } from "./sync.js";

const childId = parseUuidV7("019f742b-de82-7292-86cd-5475a1388313");

function persistence(overrides: Partial<SyncPersistence> = {}): SyncPersistence {
  return {
    async readEmergencyCard() {
      return null;
    },
    async readRecord() {
      return null;
    },
    async readRecordVersions() {
      return [];
    },
    async pull() {
      return {
        changes: [],
        hasMore: false,
        headSequence: 8,
        minimumSequence: 1,
        nextSequence: 8,
      };
    },
    async push() {
      return [];
    },
    async snapshot() {
      return {
        capturedSequence: 8,
        hasMore: false,
        items: [
          {
            childId,
            dateOfBirth: "2020-01-01",
            preferredName: "Synthetic Child",
            revision: 1,
            updatedAt: "2026-07-22T12:00:00.000Z",
          },
        ],
        nextAfterEntityType: null,
        nextAfterId: null,
      };
    },
    ...overrides,
  };
}

describe("OFF-04 sync service", () => {
  it("requests initial reset and signs captured snapshot cursors", async () => {
    const service = createSyncService({
      cursorCodec: createSyncCursorCodec(Buffer.alloc(32, 4)),
      persistence: persistence(),
    });

    await expect(
      service.pull({ identityUserId: "synthetic-user", limit: 50 }),
    ).resolves.toMatchObject({ kind: "resetRequired", reason: "initialSync" });
    const snapshot = await service.snapshot({ identityUserId: "synthetic-user", limit: 50 });
    expect(snapshot.items).toHaveLength(1);
    await expect(
      service.pull({
        cursor: snapshot.capturedCursor,
        identityUserId: "synthetic-user",
        limit: 50,
      }),
    ).resolves.toMatchObject({ kind: "changes" });
  });

  it("returns typed cursor expiry from the retained sequence floor", async () => {
    const codec = createSyncCursorCodec(Buffer.alloc(32, 5));
    const service = createSyncService({
      cursorCodec: codec,
      persistence: persistence({
        pull: vi.fn(async () => ({
          changes: [],
          hasMore: false,
          headSequence: 20,
          minimumSequence: 10,
          nextSequence: 2,
        })),
      }),
    });

    await expect(
      service.pull({
        cursor: codec.createChangesCursor(2),
        identityUserId: "synthetic-user",
        limit: 50,
      }),
    ).resolves.toMatchObject({ kind: "resetRequired", reason: "cursorExpired" });
  });

  it("rejects a feed cursor used for snapshot pagination", async () => {
    const codec = createSyncCursorCodec(Buffer.alloc(32, 6));
    const service = createSyncService({ cursorCodec: codec, persistence: persistence() });
    await expect(
      service.snapshot({
        cursor: codec.createChangesCursor(1),
        identityUserId: "synthetic-user",
        limit: 50,
      }),
    ).rejects.toThrow("invalid or has been modified");
  });
});
