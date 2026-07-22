import "react-native-gesture-handler";
import "../src/theme/unistyles";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { mobileObservability } from "../src/bootstrap/observability";
import { Button } from "../src/components/ui/Button";
import { Typography } from "../src/components/ui/Typography";
import { useDesignSystemPreferences } from "../src/theme/unistyles";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
    },
  },
});

type RouteErrorBoundaryProps = {
  readonly error: Error;
  readonly retry: () => void;
};

export function ErrorBoundary({ error, retry }: RouteErrorBoundaryProps) {
  useEffect(() => {
    void error;
    mobileObservability.errors.capture("mobile.runtime.unhandled");
  }, [error]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.errorShell}>
        <View style={styles.errorContent}>
          <Typography accessibilityRole="header" align="center" textRole="sectionTitle">
            LittleArc could not open this screen
          </Typography>
          <Typography align="center">
            Try again. If the problem continues, report code LA-MOBILE-UNHANDLED.
          </Typography>
          <Button label="Try again" onPress={retry} />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  useDesignSystemPreferences();

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(app)" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme) => ({
  errorContent: {
    gap: theme.spacing.md,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  errorShell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flex: 1,
    justifyContent: "center",
    padding: theme.layout.screenPadding,
  },
  root: {
    flex: 1,
  },
}));
