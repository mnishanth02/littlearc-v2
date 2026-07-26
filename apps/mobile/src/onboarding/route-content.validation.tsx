import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getMobileEnvironment } from "../bootstrap/environment";
import { OnboardingActivationShell } from "./OnboardingActivationShell";
import { createOff06PhysicalValidationAdapter } from "./physical-validation";

export default function Off06ValidationRoute() {
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

  return <OnboardingActivationShell adapter={adapter} platform={platform} />;
}
