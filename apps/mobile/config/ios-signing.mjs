const registeredBundleIdentifier = "app.littlearc.mobile";
const defaultPersonalBundleIdentifier = "com.nishanth.littlearc.dev";

export function resolveIosSigningProfile(environment = process.env) {
  const mode = environment.LITTLEARC_IOS_SIGNING_MODE || "registered";
  if (mode !== "registered" && mode !== "personal") {
    throw new Error(
      "LITTLEARC_IOS_SIGNING_MODE must be either registered or personal.",
    );
  }

  const bundleIdentifier =
    mode === "personal"
      ? environment.LITTLEARC_IOS_PERSONAL_BUNDLE_IDENTIFIER ||
        defaultPersonalBundleIdentifier
      : registeredBundleIdentifier;
  const shareExtensionEnabled = readBoolean(
    environment.ENABLE_IOS_SHARE_EXTENSION,
    mode === "registered",
  );

  return {
    mode,
    bundleIdentifier,
    shareExtensionEnabled,
    extensionBundleIdentifier: `${bundleIdentifier}.expo-sharing-extension`,
    appGroupId: `group.${bundleIdentifier}`,
  };
}

function readBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error("ENABLE_IOS_SHARE_EXTENSION must be either true or false.");
}
