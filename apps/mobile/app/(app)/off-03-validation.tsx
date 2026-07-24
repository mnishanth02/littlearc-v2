import { deviceEnrollmentResponseSchema } from "@littlearc/contracts";
import { createUuidV7 } from "@littlearc/domain";
import Constants from "expo-constants";
import { getRandomBytes } from "expo-crypto";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { getMobileEnvironment } from "../../src/bootstrap/environment";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";
import {
  confirmReauthenticationRequired,
  enrollLocalSecurity,
  inspectLocalSecurityCapability,
  simulateProtectedKeyInvalidationForValidation,
  validateUnlockedLocalSecurity,
  verifyLocalSecurityWiped,
  wipeLocalSecurity,
} from "../../src/local-security/native";

type Step =
  | "capability"
  | "enrollment"
  | "unlock"
  | "invalidation"
  | "recovery"
  | "wipe"
  | "complete"
  | "working"
  | "error";

export default function Off03ValidationScreen() {
  const environment = getMobileEnvironment();
  const deviceId = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const [step, setStep] = useState<Step>("capability");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [summary, setSummary] = useState<string>();

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setStep("working");
    setErrorMessage(undefined);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "OFF-03 validation failed.");
      setStep("error");
    }
  }

  async function enroll(): Promise<void> {
    const response = await fetch(`${environment.apiBaseUrl}/v1/devices/enrollment`, {
      body: JSON.stringify({
        appVersion: Constants.expoConfig?.version ?? "0.0.1",
        deviceId,
        localSchemaVersion: 1,
        platform: process.env.EXPO_OS === "ios" ? "ios" : "android",
      }),
      headers: {
        "content-type": "application/json",
        "x-littlearc-synthetic-session": "off03-device-validation",
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Synthetic device enrollment returned HTTP ${response.status}.`);
    }
    const result = deviceEnrollmentResponseSchema.parse(await response.json());
    const local = await enrollLocalSecurity({
      deviceId: result.deviceId,
      householdId: result.householdId,
    });
    setSummary(`SQLCipher ${local.cipherVersion} · generation ${local.generationId}`);
    setStep("unlock");
  }

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="screenTitle">
          OFF-03 local security
        </Typography>
        <Banner
          message="This development-only flow uses an authority-neutral synthetic device and temporary database. It never asks for parent, child, or medical information."
          title="Synthetic evidence boundary"
          variant="warning"
        />

        {step === "capability" ? (
          <ValidationStep
            action="Check device security"
            body="Confirm enrolled strong biometrics and protected SecureStore support."
            onPress={() =>
              void run(async () => {
                const capability = await inspectLocalSecurityCapability();
                if (!capability.strongBiometricReady) {
                  throw new Error(
                    "This device is not ready for strong biometric local protection.",
                  );
                }
                setSummary(
                  `Strong biometric ready · ${capability.authenticationTypeCount} authentication type(s)`,
                );
                setStep("enrollment");
              })
            }
            testID="off03-capability"
            title="1. Device capability"
          />
        ) : null}
        {step === "enrollment" ? (
          <ValidationStep
            action="Enroll this synthetic installation"
            body="Register the installation, create a protected random SQLCipher key, and apply local schema V1."
            onPress={() => void run(enroll)}
            testID="off03-enrollment"
            title="2. Device and local enrollment"
          />
        ) : null}
        {step === "unlock" ? (
          <ValidationStep
            action="Unlock and validate encrypted storage"
            body="Use the system biometric prompt, reopen SQLCipher, reject a wrong key, and verify authenticated per-file encryption."
            onPress={() =>
              void run(async () => {
                const result = await validateUnlockedLocalSecurity();
                if (
                  !result.reopenPassed ||
                  !result.wrongDatabaseKeyRejected ||
                  !result.fileWrongAadRejected ||
                  !result.fileTamperRejected
                ) {
                  throw new Error("One or more native encrypted-storage controls did not pass.");
                }
                setSummary(
                  `SQLCipher ${result.cipherVersion} · schema ${result.migrationVersion} · wrong key/AAD/tamper rejected`,
                );
                setStep("invalidation");
              })
            }
            testID="off03-unlock"
            title="3. App lock and encrypted storage"
          />
        ) : null}
        {step === "invalidation" ? (
          <ValidationStep
            action="Simulate protected-key invalidation"
            body="Delete only the protected database key and verify the enrolled install requires account reauthentication instead of falling back."
            onPress={() =>
              void run(async () => {
                await simulateProtectedKeyInvalidationForValidation();
                if (!(await confirmReauthenticationRequired())) {
                  throw new Error(
                    "The invalidated key did not enter reauthentication-required state.",
                  );
                }
                setSummary("Protected key unavailable · account reauthentication required");
                setStep("recovery");
              })
            }
            testID="off03-invalidation"
            title="4. Invalidation handling"
          />
        ) : null}
        {step === "recovery" ? (
          <ValidationStep
            action="Reauthenticate and safely resynchronize"
            body="Use the named synthetic session, remove unrecoverable ciphertext, create a fresh local generation, and replay server enrollment."
            onPress={() =>
              void run(async () => {
                await wipeLocalSecurity();
                await enroll();
                const recovered = await validateUnlockedLocalSecurity();
                if (!recovered.reopenPassed || !recovered.wrongDatabaseKeyRejected) {
                  throw new Error(
                    "The fresh local generation did not reopen after reauthentication.",
                  );
                }
                setSummary(
                  `Fresh SQLCipher generation · schema ${recovered.migrationVersion} · server enrollment replayed`,
                );
                setStep("wipe");
              })
            }
            testID="off03-recovery"
            title="5. Safe recovery"
          />
        ) : null}
        {step === "wipe" ? (
          <ValidationStep
            action="Sign out and verify local wipe"
            body="Remove the SQLCipher database, encrypted-file cache, file-key index, enrollment marker, and protected keys."
            onPress={() =>
              void run(async () => {
                await wipeLocalSecurity();
                if (!(await verifyLocalSecurityWiped())) {
                  throw new Error("Local security artifacts remained after sign-out cleanup.");
                }
                setSummary("Device enrollment exercised · all OFF-03 local artifacts wiped");
                setStep("complete");
              })
            }
            testID="off03-wipe"
            title="6. Sign-out wipe"
          />
        ) : null}
        {step === "working" ? (
          <View accessibilityLiveRegion="polite" style={styles.panel}>
            <Typography textRole="sectionTitle">Running the native security check</Typography>
            <Button disabled label="Validating" loading />
          </View>
        ) : null}
        {step === "error" ? (
          <Banner
            actionLabel="Reset synthetic local state"
            message={errorMessage ?? "The OFF-03 validation flow could not continue."}
            onActionPress={() =>
              void run(async () => {
                await wipeLocalSecurity();
                setSummary("Synthetic local state reset · ready to validate again");
                setStep("capability");
              })
            }
            title="Local security validation stopped"
            variant="danger"
          />
        ) : null}
        {step === "complete" ? (
          <View
            accessibilityLabel="OFF-03 device validation passed"
            accessibilityRole="summary"
            style={styles.panel}
          >
            <Typography textRole="sectionTitle">Local security lifecycle passed</Typography>
            <Typography>
              Device enrollment, strong app lock, SQLCipher migration and reopen, independent
              authenticated file encryption, invalidation recovery, and sign-out wipe completed.
            </Typography>
          </View>
        ) : null}
        {summary ? (
          <Typography selectable textRole="caption" tone="muted">
            {summary}
          </Typography>
        ) : null}
      </View>
    </ScrollView>
  );
}

function ValidationStep(props: {
  readonly action: string;
  readonly body: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly title: string;
}) {
  return (
    <View style={styles.panel}>
      <Typography textRole="sectionTitle">{props.title}</Typography>
      <Typography>{props.body}</Typography>
      <Button label={props.action} onPress={props.onPress} testID={props.testID} />
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
