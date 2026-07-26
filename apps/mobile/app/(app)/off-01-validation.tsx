import * as Linking from "expo-linking";
import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { mobileAuthClient } from "../../src/auth/client";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";

type ValidationState = "idle" | "running" | "passed" | "failed";

type ValidationResult = {
  readonly authClient: "Passed" | "Pending";
  readonly deepLink: "Passed" | "Pending";
  readonly secureStore: "Passed" | "Pending";
};

const secureStoreKey = "littlearc.off01.device-validation";
const secureStoreValue = "synthetic-session-probe";
const pendingResult: ValidationResult = {
  authClient: "Pending",
  deepLink: "Pending",
  secureStore: "Pending",
};

export default function Off01ValidationScreen() {
  const [state, setState] = useState<ValidationState>("idle");
  const [result, setResult] = useState<ValidationResult>(pendingResult);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  async function runValidation(): Promise<void> {
    setState("running");
    setResult(pendingResult);

    try {
      if (!mobileAuthClient) {
        throw new Error("The Better Auth Expo client did not initialize.");
      }
      const secureStoreAvailable = await SecureStore.isAvailableAsync();
      if (!secureStoreAvailable) {
        throw new Error("SecureStore is unavailable on this device.");
      }

      await SecureStore.setItemAsync(secureStoreKey, secureStoreValue);
      const storedValue = await SecureStore.getItemAsync(secureStoreKey);
      await SecureStore.deleteItemAsync(secureStoreKey);
      const deletedValue = await SecureStore.getItemAsync(secureStoreKey);
      if (storedValue !== secureStoreValue || deletedValue !== null) {
        throw new Error("SecureStore did not preserve the expected lifecycle.");
      }

      const deepLink = Linking.createURL("/off-01-validation");
      if (!deepLink.startsWith("littlearc://")) {
        throw new Error("The LittleArc deep-link scheme is unavailable.");
      }

      setResult({ authClient: "Passed", deepLink: "Passed", secureStore: "Passed" });
      setState("passed");
    } catch {
      await SecureStore.deleteItemAsync(secureStoreKey).catch(() => undefined);
      setState("failed");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="screenTitle">
          OFF-01 device validation
        </Typography>
        <Banner
          message="This development-only check uses synthetic state and does not contact live identity or email providers."
          title="Physical-device boundary"
          variant="info"
        />
        <View
          accessibilityLabel={`OFF-01 device validation ${state}`}
          style={styles.resultPanel}
          testID="off01-validation-result"
        >
          <ValidationRow
            label="Better Auth Expo client initialization"
            status={result.authClient}
          />
          <ValidationRow label="SecureStore write, read, and delete" status={result.secureStore} />
          <ValidationRow label="LittleArc deep-link scheme" status={result.deepLink} />
        </View>
        {state === "failed" ? (
          <Banner
            message="One or more device checks failed. No sensitive diagnostic value was retained."
            title="Validation failed"
            variant="danger"
          />
        ) : null}
        <Button
          label={state === "passed" ? "Run validation again" : "Run device validation"}
          loading={state === "running"}
          onPress={() => void runValidation()}
          testID="off01-run-validation"
        />
      </View>
    </ScrollView>
  );
}

function ValidationRow({ label, status }: { readonly label: string; readonly status: string }) {
  return (
    <View style={styles.resultRow}>
      <Typography style={styles.resultLabel}>{label}</Typography>
      <Typography textRole="label" tone={status === "Passed" ? "primary" : "muted"}>
        {status}
      </Typography>
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
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  resultLabel: {
    flex: 1,
  },
  resultPanel: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  resultRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: theme.touchTargets.minimum,
  },
}));
