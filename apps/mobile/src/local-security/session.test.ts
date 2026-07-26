import { describe, expect, it, vi } from "vitest";
import { createLocalSecuritySessionCache } from "./session";

describe("local-security foreground session", () => {
  it("coalesces concurrent unlocks and reuses the unlocked value", async () => {
    const cache = createLocalSecuritySessionCache<string>();
    const unlock = vi.fn(async () => "protected-key");

    await expect(
      Promise.all([cache.getOrUnlock(unlock), cache.getOrUnlock(unlock)]),
    ).resolves.toEqual(["protected-key", "protected-key"]);
    await expect(cache.getOrUnlock(unlock)).resolves.toBe("protected-key");
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it("requires a fresh unlock after the foreground session is locked", async () => {
    const cache = createLocalSecuritySessionCache<string>();
    const unlock = vi.fn(async () => "protected-key");

    await cache.getOrUnlock(unlock);
    cache.lock();
    await cache.getOrUnlock(unlock);

    expect(unlock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed unlock", async () => {
    const cache = createLocalSecuritySessionCache<string>();
    const unlock = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("cancelled"))
      .mockResolvedValueOnce("protected-key");

    await expect(cache.getOrUnlock(unlock)).rejects.toThrow("cancelled");
    await expect(cache.getOrUnlock(unlock)).resolves.toBe("protected-key");
    expect(unlock).toHaveBeenCalledTimes(2);
  });

  it("does not restore a session whose authentication completed after locking", async () => {
    const cache = createLocalSecuritySessionCache<string>();
    let finishUnlock: ((value: string) => void) | undefined;
    const unlock = () =>
      new Promise<string>((resolve) => {
        finishUnlock = resolve;
      });

    const pending = cache.getOrUnlock(unlock);
    cache.lock();
    finishUnlock?.("stale-key");

    await expect(pending).rejects.toThrow("locked during authentication");
    expect(cache.current()).toBeUndefined();
  });

  it("does not let stale authentication cleanup clear a newer unlock", async () => {
    const cache = createLocalSecuritySessionCache<string>();
    let finishStale: ((value: string) => void) | undefined;
    let finishFresh: ((value: string) => void) | undefined;
    const staleUnlock = () =>
      new Promise<string>((resolve) => {
        finishStale = resolve;
      });
    const freshUnlock = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishFresh = resolve;
        }),
    );

    const stale = cache.getOrUnlock(staleUnlock);
    cache.lock();
    const fresh = cache.getOrUnlock(freshUnlock);
    finishStale?.("stale-key");
    await expect(stale).rejects.toThrow("locked during authentication");

    const coalesced = cache.getOrUnlock(freshUnlock);
    expect(freshUnlock).toHaveBeenCalledTimes(1);
    finishFresh?.("fresh-key");
    await expect(Promise.all([fresh, coalesced])).resolves.toEqual(["fresh-key", "fresh-key"]);
  });
});
