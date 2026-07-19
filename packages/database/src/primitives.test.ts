import {
  type IdempotencyKey,
  type MutationId,
  parseIdempotencyKey,
  parseMutationId,
  parseUuidV7,
} from "@littlearc/domain";
import { describe, expect, it } from "vitest";
import { createChangeFeedCursor, parseChangeFeedCursor } from "./change-feed.js";
import { assertReplayMatchesReservation, idempotencyScopeKey } from "./idempotency.js";
import { isOutboxDispatchable, outboxDispatchState } from "./outbox.js";
import { databaseRoleName, orderedDatabaseRoleKinds } from "./roles.js";
import { tenantContextSetSql, tenantContextSettings } from "./tenant-context.js";

const householdId = parseUuidV7("019f7332-9782-78c2-b57f-427e19bc2973");
const actorId = parseUuidV7("019f7332-9782-78c2-b57f-427e19bc2974");
const idempotencyKey = parseIdempotencyKey("019f7332-9782-78c2-b57f-427e19bc2975");
const mutationId = parseMutationId("019f7332-9782-78c2-b57f-427e19bc2976");

describe("database primitives", () => {
  it("builds tenant context with parameterized PostgreSQL setting calls", () => {
    expect(tenantContextSettings).toEqual({
      actorId: "littlearc.current_actor_id",
      actorRole: "littlearc.current_actor_role",
      householdId: "littlearc.current_household_id",
    });
    expect(
      tenantContextSetSql({
        actorId,
        actorRole: "owner",
        householdId,
      }),
    ).toEqual({
      params: [
        "littlearc.current_household_id",
        householdId,
        "littlearc.current_actor_id",
        actorId,
        "littlearc.current_actor_role",
        "owner",
      ],
      sql: [
        "select set_config($1, $2, true);",
        "select set_config($3, $4, true);",
        "select set_config($5, $6, true);",
      ].join("\n"),
    });
  });

  it("keeps database role names centralized", () => {
    expect(orderedDatabaseRoleKinds.map(databaseRoleName)).toEqual([
      "littlearc_migration",
      "littlearc_app",
      "littlearc_worker",
      "littlearc_ops_readonly",
    ]);
  });

  it("keys idempotency results by household, actor, and idempotency key", () => {
    expect(
      idempotencyScopeKey({
        actorId,
        householdId,
        idempotencyKey,
      }),
    ).toBe(`${householdId}:${actorId}:${idempotencyKey}`);

    expect(() =>
      assertReplayMatchesReservation(
        {
          actorId,
          householdId,
          idempotencyKey: idempotencyKey as IdempotencyKey,
          mutationId: mutationId as MutationId,
          requestFingerprint: "sha256:original",
        },
        "sha256:different",
      ),
    ).toThrow("different request fingerprint");
  });

  it("encodes opaque change-feed cursors from server sequence numbers", () => {
    const cursor = createChangeFeedCursor(42);

    expect(parseChangeFeedCursor(cursor)).toEqual({ sequence: 42, version: 1 });
    expect(() => createChangeFeedCursor(-1)).toThrow("non-negative safe integer");
  });

  it("classifies outbox dispatch state from durable fields", () => {
    expect(
      isOutboxDispatchable({
        attempts: 0,
        availableAt: "2026-07-19T00:00:00.000Z",
        dispatchedAt: null,
        maxAttempts: 3,
        now: "2026-07-19T00:00:01.000Z",
      }),
    ).toBe(true);

    expect(
      outboxDispatchState({
        attempts: 3,
        availableAt: "2026-07-19T00:00:00.000Z",
        dispatchedAt: null,
        maxAttempts: 3,
        now: "2026-07-19T00:00:01.000Z",
      }),
    ).toBe("failed");
  });
});
