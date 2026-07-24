const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const validationRouteSuffix = "/src/onboarding/route-content.validation";

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!context.dev && moduleName.endsWith(validationRouteSuffix)) {
    return context.resolveRequest(
      context,
      moduleName.slice(0, -validationRouteSuffix.length) +
        "/src/onboarding/route-content.production",
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
