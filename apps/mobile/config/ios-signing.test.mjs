import { describe, expect, it } from "vitest";

import { resolveIosSigningProfile } from "./ios-signing.mjs";

describe("resolveIosSigningProfile", () => {
  it("preserves registered signing and the incoming-share target by default", () => {
    expect(resolveIosSigningProfile({})).toEqual({
      mode: "registered",
      bundleIdentifier: "app.littlearc.mobile",
      shareExtensionEnabled: true,
      extensionBundleIdentifier:
        "app.littlearc.mobile.expo-sharing-extension",
      appGroupId: "group.app.littlearc.mobile",
    });
  });

  it("uses a separate main-target-only identity for Personal Team builds", () => {
    expect(
      resolveIosSigningProfile({
        LITTLEARC_IOS_SIGNING_MODE: "personal",
      }),
    ).toEqual({
      mode: "personal",
      bundleIdentifier: "com.nishanth.littlearc.dev",
      shareExtensionEnabled: false,
      extensionBundleIdentifier:
        "com.nishanth.littlearc.dev.expo-sharing-extension",
      appGroupId: "group.com.nishanth.littlearc.dev",
    });
  });

  it("allows an explicit Personal Team share-extension experiment", () => {
    expect(
      resolveIosSigningProfile({
        ENABLE_IOS_SHARE_EXTENSION: "true",
        LITTLEARC_IOS_PERSONAL_BUNDLE_IDENTIFIER:
          "com.example.littlearc.personal",
        LITTLEARC_IOS_SIGNING_MODE: "personal",
      }),
    ).toMatchObject({
      bundleIdentifier: "com.example.littlearc.personal",
      shareExtensionEnabled: true,
      extensionBundleIdentifier:
        "com.example.littlearc.personal.expo-sharing-extension",
      appGroupId: "group.com.example.littlearc.personal",
    });
  });

  it("rejects ambiguous build settings", () => {
    expect(() =>
      resolveIosSigningProfile({
        LITTLEARC_IOS_SIGNING_MODE: "preview",
      }),
    ).toThrow("LITTLEARC_IOS_SIGNING_MODE");
    expect(() =>
      resolveIosSigningProfile({
        ENABLE_IOS_SHARE_EXTENSION: "yes",
      }),
    ).toThrow("ENABLE_IOS_SHARE_EXTENSION");
  });
});
