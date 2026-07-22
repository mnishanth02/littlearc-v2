import { ownerOnboardingResponseSchema } from "@littlearc/contracts";
import { createUuidV7 } from "@littlearc/domain";
import { getRandomBytes } from "expo-crypto";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { getMobileEnvironment } from "../../src/bootstrap/environment";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";

const syntheticRequest = {
  adultVerificationAssertion: "synthetic-approved-off-02",
  child: {
    dateOfBirth: "2020-01-01",
    preferredName: "Synthetic Child",
  },
  childDataConsentVersion: "child-data-processing-v1",
  countryCode: "IN",
  parent: {
    displayName: "Synthetic Parent",
    relationship: "parent",
  },
  parentNoticeVersion: "parent-notice-v1",
  timeZone: "Asia/Kolkata",
} as const;

type Step = "privacy" | "verification" | "consent" | "review" | "submitting" | "complete" | "error";

export default function Off02ValidationScreen() {
  const environment = getMobileEnvironment();
  const idempotencyKey = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const [step, setStep] = useState<Step>("privacy");
  const [result, setResult] = useState<ReturnType<typeof ownerOnboardingResponseSchema.parse>>();
  const [errorMessage, setErrorMessage] = useState<string>();

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  async function submit(): Promise<void> {
    setStep("submitting");
    setErrorMessage(undefined);
    try {
      const response = await fetch(`${environment.apiBaseUrl}/v1/households/onboarding`, {
        body: JSON.stringify(syntheticRequest),
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          "x-littlearc-synthetic-session": "off02-pixel8",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Synthetic onboarding returned HTTP ${response.status}.`);
      }
      setResult(ownerOnboardingResponseSchema.parse(await response.json()));
      setStep("complete");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Synthetic onboarding could not be completed.",
      );
      setStep("error");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="screenTitle">
          OFF-02 synthetic onboarding
        </Typography>
        <Banner
          message="This development-only flow uses fixed synthetic labels and a temporary database. Do not enter real parent or child information."
          title="Synthetic evidence boundary"
          variant="warning"
        />

        {step === "privacy" ? (
          <ValidationStep
            action="Acknowledge privacy promise"
            body="Review the current synthetic-only notice before any profile is created."
            onPress={() => setStep("verification")}
            title="1. Privacy promise"
          />
        ) : null}
        {step === "verification" ? (
          <ValidationStep
            action="Run synthetic adult verification"
            body="Use the injected local fixture. No document, provider response, or adult evidence is persisted."
            onPress={() => setStep("consent")}
            title="2. Adult verification"
          />
        ) : null}
        {step === "consent" ? (
          <ValidationStep
            action="Grant required synthetic consent"
            body="Grant parent-notice-v1 and child-data-processing-v1. Optional AI and vision processing remain off."
            onPress={() => setStep("review")}
            title="3. Notice and consent"
          />
        ) : null}
        {step === "review" ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">4. Review fixed synthetic profiles</Typography>
            <Typography>Parent: Synthetic Parent · parent</Typography>
            <Typography>Child: Synthetic Child · 2020-01-01</Typography>
            <Typography>Country and time zone: IN · Asia/Kolkata</Typography>
            <Button label="Create synthetic household" onPress={() => void submit()} />
          </View>
        ) : null}
        {step === "submitting" ? (
          <View accessibilityLiveRegion="polite" style={styles.panel}>
            <Typography textRole="sectionTitle">Creating the encrypted household</Typography>
            <Button disabled label="Create synthetic household" loading />
          </View>
        ) : null}
        {step === "error" ? (
          <Banner
            actionLabel="Retry synthetic onboarding"
            message={errorMessage ?? "The temporary validation service is unavailable."}
            onActionPress={() => void submit()}
            title="Onboarding did not complete"
            variant="danger"
          />
        ) : null}
        {step === "complete" && result ? (
          <View
            accessibilityLabel="OFF-02 physical Android validation passed"
            accessibilityRole="summary"
            style={styles.panel}
          >
            <Typography textRole="sectionTitle">Synthetic household created</Typography>
            <Typography>
              Consent, encrypted parent and child profiles, tenant authorization, audit, change,
              outbox, and idempotency completed atomically.
            </Typography>
            <Typography selectable textRole="caption" tone="muted">
              Household {result.householdId}
            </Typography>
            <Typography selectable textRole="caption" tone="muted">
              Child {result.childId}
            </Typography>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function ValidationStep(props: {
  readonly action: string;
  readonly body: string;
  readonly onPress: () => void;
  readonly title: string;
}) {
  return (
    <View style={styles.panel}>
      <Typography textRole="sectionTitle">{props.title}</Typography>
      <Typography>{props.body}</Typography>
      <Button label={props.action} onPress={props.onPress} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flexGrow: 1,
    padding: theme.layout.screenPadding,
  },
  content: {
    gap: theme.spacing.md,
    maxWidth: theme.layout.contentMaxWidth,
    paddingVertical: theme.spacing.lg,
    width: "100%",
  },
  panel: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
}));
