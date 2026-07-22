import { Stack } from "expo-router";
import { useUnistyles } from "react-native-unistyles";

export default function AppGroupLayout() {
  const { theme } = useUnistyles();

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
    </Stack>
  );
}
