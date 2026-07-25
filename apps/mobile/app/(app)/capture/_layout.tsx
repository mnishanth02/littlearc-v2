import { Stack } from "expo-router";
import { useUnistyles } from "react-native-unistyles";

export default function CaptureLayout() {
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
      <Stack.Screen name="index" options={{ title: "Capture record source" }} />
    </Stack>
  );
}
