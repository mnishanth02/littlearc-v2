import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { lockLocalSecuritySession } from "../../src/local-security/native";

export default function AppGroupLayout() {
  const { theme } = useUnistyles();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        lockLocalSecuritySession();
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.background.primary },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.background.primary },
        headerTintColor: theme.colors.text.primary,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="status" options={{ title: "Runtime status" }} />
      <Stack.Screen name="emergency" options={{ title: "Emergency card" }} />
      <Stack.Screen name="emergency-edit" options={{ title: "Edit emergency card" }} />
      <Stack.Screen name="records" options={{ headerShown: false }} />
      <Stack.Screen name="capture" options={{ headerShown: false }} />
      {__DEV__ ? <Stack.Screen name="design-system" options={{ title: "Design system" }} /> : null}
      {__DEV__ ? (
        <Stack.Screen name="off-01-validation" options={{ title: "OFF-01 validation" }} />
      ) : null}
      {__DEV__ ? (
        <Stack.Screen name="off-02-validation" options={{ title: "OFF-02 validation" }} />
      ) : null}
      {__DEV__ ? (
        <Stack.Screen name="off-03-validation" options={{ title: "OFF-03 validation" }} />
      ) : null}
      {__DEV__ ? (
        <Stack.Screen name="off-04-validation" options={{ title: "OFF-04 validation" }} />
      ) : null}
      {__DEV__ ? (
        <Stack.Screen name="off-05-validation" options={{ title: "OFF-05 validation" }} />
      ) : null}
      {__DEV__ ? (
        <Stack.Screen name="vlt-01-validation" options={{ title: "VLT-01 validation" }} />
      ) : null}
      {__DEV__ ? (
        <Stack.Screen name="vlt-02-validation" options={{ title: "VLT-02 validation" }} />
      ) : null}
      {__DEV__ ? (
        <Stack.Screen name="vlt-03-validation" options={{ title: "VLT-03 validation" }} />
      ) : null}
    </Stack>
  );
}
