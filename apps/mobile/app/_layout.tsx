import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { Button, StyleSheet, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

type RouteErrorBoundaryProps = {
  readonly error: Error;
  readonly retry: () => void;
};

export function ErrorBoundary({ error, retry }: RouteErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.errorShell}>
        <Text accessibilityRole="header" style={styles.errorTitle}>
          LittleArc could not open this screen
        </Text>
        <Text style={styles.errorBody}>{error.message}</Text>
        <Button
          accessibilityLabel="Try opening this screen again"
          title="Try again"
          onPress={retry}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorBody: {
    color: "#394034",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  errorShell: {
    alignItems: "center",
    backgroundColor: "#f7f4ec",
    flex: 1,
    gap: 16,
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    color: "#1f2a24",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    textAlign: "center",
  },
  root: {
    flex: 1,
  },
});
