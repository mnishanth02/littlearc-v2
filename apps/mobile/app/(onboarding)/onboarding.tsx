import { useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo } from "react";
import { getMobileEnvironment } from "../../src/bootstrap/environment";
import { OnboardingActivationShell } from "../../src/onboarding/OnboardingActivationShell";
import { createOff06PhysicalValidationAdapter } from "../../src/onboarding/physical-validation";

export default function OnboardingRoute() {
  const queryClient = useQueryClient();
  const environment = getMobileEnvironment();
  const platform = process.env.EXPO_OS === "ios" ? "ios" : "android";
  const adapter = useMemo(
    () =>
      createOff06PhysicalValidationAdapter({
        apiBaseUrl: environment.apiBaseUrl,
        platform,
        queryClient,
      }),
    [environment.apiBaseUrl, platform, queryClient],
  );

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <OnboardingActivationShell adapter={adapter} platform={platform} />;
}
