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
      {__DEV__ ? <Stack.Screen name="design-system" options={{ title: "Design system" }} /> : null}
    </Stack>
  );
}
