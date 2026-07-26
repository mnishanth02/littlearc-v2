const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const validationRouteSuffix = "/src/onboarding/route-content.validation";
const appValidationRoute = /\/app\/\(app\)\/(?:off-\d{2}|vlt-\d{2})-validation(?:\.[jt]sx?)?$/;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!context.dev && moduleName.endsWith(validationRouteSuffix)) {
    return context.resolveRequest(
      context,
      moduleName.slice(0, -validationRouteSuffix.length) +
        "/src/onboarding/route-content.production",
      platform,
    );
  }

  if (!context.dev && appValidationRoute.test(moduleName)) {
    return context.resolveRequest(
      context,
      moduleName.replace(
        appValidationRoute,
        "/src/validation/route-content.production",
      ),
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
