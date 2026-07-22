import { describe, expect, it } from "vitest";
import {
  assertRecentAuthentication,
  hasRecentAuthentication,
  RecentAuthenticationRequiredError,
} from "./recent-authentication.js";

describe("recent authentication policy", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("accepts a session inside the ten-minute window", () => {
    expect(
      hasRecentAuthentication({
        authenticatedAt: "2026-07-20T11:50:00.000Z",
        now,
      }),
    ).toBe(true);
  });

  it("rejects missing, stale, future, and invalid timestamps", () => {
    expect(hasRecentAuthentication({ authenticatedAt: undefined, now })).toBe(false);
    expect(hasRecentAuthentication({ authenticatedAt: null, now })).toBe(false);
    expect(hasRecentAuthentication({ authenticatedAt: "2026-07-20T11:49:59.999Z", now })).toBe(
      false,
    );
    expect(hasRecentAuthentication({ authenticatedAt: "2026-07-20T12:00:00.001Z", now })).toBe(
      false,
    );
    expect(hasRecentAuthentication({ authenticatedAt: "not-a-date", now })).toBe(false);
  });

  it("raises a stable policy error for sensitive actions", () => {
    expect(() =>
      assertRecentAuthentication({
        authenticatedAt: "2026-07-20T11:00:00.000Z",
        now,
      }),
    ).toThrow(RecentAuthenticationRequiredError);
  });
});
