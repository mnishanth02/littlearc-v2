import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSharedPayloads: vi.fn(),
}));

vi.mock("expo-sharing", () => ({
  getSharedPayloads: mocks.getSharedPayloads,
}));

import { redirectSystemPath } from "../../app/+native-intent";

describe("VLT-03 native intent routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes a resolved Expo share payload into the bounded capture entry", async () => {
    mocks.getSharedPayloads.mockReturnValueOnce([{ contentType: "file" }]);

    await expect(
      redirectSystemPath({
        initial: true,
        path: "littlearc://expo-sharing",
      }),
    ).resolves.toBe("/capture?source=share");
  });

  it("does not claim an Expo share URL when no payload is available", async () => {
    mocks.getSharedPayloads.mockReturnValueOnce([]);

    await expect(
      redirectSystemPath({
        initial: true,
        path: "littlearc://expo-sharing",
      }),
    ).resolves.toBe("littlearc://expo-sharing");
  });

  it("does not consume a payload for an unrelated URL scheme", async () => {
    mocks.getSharedPayloads.mockReturnValueOnce([{ contentType: "file" }]);

    await expect(
      redirectSystemPath({
        initial: true,
        path: "https://expo-sharing",
      }),
    ).resolves.toBe("https://expo-sharing");
  });

  it("fails malformed native paths closed", async () => {
    mocks.getSharedPayloads.mockReturnValueOnce([]);

    await expect(redirectSystemPath({ initial: false, path: "not a URL" })).resolves.toBe("/");
  });
});
