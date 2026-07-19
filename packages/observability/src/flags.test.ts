import { describe, expect, it, vi } from "vitest";
import {
  assertFeatureFlagDefinitions,
  createFeatureFlags,
  type FeatureFlagName,
  featureFlagDefinitions,
} from "./flags.js";

describe("feature flag guards", () => {
  it("defines the four kill switches with false defaults, owners, and expiries", () => {
    expect(featureFlagDefinitions).toEqual({
      ai_extraction: { defaultValue: false, expiresAt: "2027-07-19", owner: "UTL-08" },
      caregiver_sharing: { defaultValue: false, expiresAt: "2027-07-19", owner: "UTL-06" },
      notifications: { defaultValue: false, expiresAt: "2027-07-19", owner: "UTL-02" },
      uploads: { defaultValue: false, expiresAt: "2027-07-19", owner: "VLT-04" },
    });
    expect(() => assertFeatureFlagDefinitions(new Date("2026-07-19T00:00:00Z"))).not.toThrow();
    expect(() => assertFeatureFlagDefinitions(new Date("2027-07-20T00:00:00Z"))).toThrow(
      "requires review",
    );
  });

  it("fails closed without a provider or when the provider fails", async () => {
    await expect(createFeatureFlags().isEnabled("uploads")).resolves.toBe(false);
    await expect(
      createFeatureFlags({
        provider: { isEnabled: async () => Promise.reject(new Error("provider response")) },
      }).isEnabled("notifications"),
    ).resolves.toBe(false);
    await expect(
      createFeatureFlags({
        provider: { isEnabled: async () => "invalid" as never },
      }).isEnabled("uploads"),
    ).resolves.toBe(false);
  });

  it("passes only the allowlisted flag name to a provider", async () => {
    const received: FeatureFlagName[] = [];
    const flags = createFeatureFlags({
      now: () => new Date("2026-07-19T00:00:00Z"),
      provider: {
        async isEnabled(flag) {
          received.push(flag);
          return true;
        },
      },
    });

    await expect(flags.isEnabled("caregiver_sharing")).resolves.toBe(true);
    expect(received).toEqual(["caregiver_sharing"]);
  });

  it("fails closed on provider timeout and after expiry", async () => {
    vi.useFakeTimers();
    const flags = createFeatureFlags({
      now: () => new Date("2026-07-19T00:00:00Z"),
      provider: { isEnabled: async () => new Promise<boolean>(() => undefined) },
      timeoutMs: 10,
    });
    const result = flags.isEnabled("ai_extraction");
    await vi.advanceTimersByTimeAsync(10);
    await expect(result).resolves.toBe(false);
    vi.useRealTimers();

    const expired = createFeatureFlags({
      now: () => new Date("2027-07-20T00:00:00Z"),
      provider: { isEnabled: async () => true },
    });
    await expect(expired.isEnabled("uploads")).resolves.toBe(false);
  });
});
