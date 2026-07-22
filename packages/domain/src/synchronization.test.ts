import { describe, expect, it } from "vitest";
import { parseMutationId } from "./primitives.js";
import {
  dependencyReadiness,
  fullJitterRetryDelay,
  isRetryableSyncFailure,
  signOutRisk,
} from "./synchronization.js";

const first = parseMutationId("019f742b-de82-7292-86cd-5475a1388313");
const second = parseMutationId("019f742b-de82-7292-86cd-5475a1388314");

describe("OFF-04 synchronization policy", () => {
  it("dispatches only when every dependency completed", () => {
    expect(dependencyReadiness([], new Map())).toBe("ready");
    expect(dependencyReadiness([first], new Map([[first, "applied"]]))).toBe("ready");
    expect(dependencyReadiness([first], new Map([[first, "duplicate"]]))).toBe("ready");
    expect(dependencyReadiness([first], new Map([[first, "retrying"]]))).toBe("blocked");
    expect(dependencyReadiness([first], new Map())).toBe("blocked");
    expect(
      dependencyReadiness(
        [first, second],
        new Map([
          [first, "applied"],
          [second, "conflict"],
        ]),
      ),
    ).toBe("failed");
  });

  it("uses bounded exponential full jitter", () => {
    expect(fullJitterRetryDelay({ attempt: 1, randomUnit: 0 })).toBe(0);
    expect(fullJitterRetryDelay({ attempt: 1, randomUnit: 0.999 })).toBeLessThanOrEqual(1_000);
    expect(fullJitterRetryDelay({ attempt: 4, randomUnit: 0.5 })).toBe(4_000);
    expect(fullJitterRetryDelay({ attempt: 40, randomUnit: 0.999 })).toBeLessThanOrEqual(300_000);
    expect(() => fullJitterRetryDelay({ attempt: 0, randomUnit: 0.5 })).toThrow("attempt");
    expect(() => fullJitterRetryDelay({ attempt: 1, randomUnit: 1 })).toThrow("jitter");
  });

  it("retries only network and server failures", () => {
    expect(isRetryableSyncFailure("network")).toBe(true);
    expect(isRetryableSyncFailure("server")).toBe(true);
    expect(isRetryableSyncFailure("authentication")).toBe(false);
    expect(isRetryableSyncFailure("authorization")).toBe(false);
    expect(isRetryableSyncFailure("validation")).toBe(false);
  });

  it("requires explicit discard for every unsynchronized or review state", () => {
    expect(signOutRisk(["applied", "duplicate"])).toEqual({
      requiresExplicitDiscard: false,
      riskyMutationCount: 0,
    });
    expect(signOutRisk(["pending", "retrying", "rejected", "conflict"])).toEqual({
      requiresExplicitDiscard: true,
      riskyMutationCount: 4,
    });
  });
});
