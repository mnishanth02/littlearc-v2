import { Stack } from "expo-router";
import { useUnistyles } from "react-native-unistyles";

export default function RecordsLayout() {
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
      <Stack.Screen name="index" options={{ title: "Manual records" }} />
      <Stack.Screen name="new" options={{ title: "New manual record" }} />
      <Stack.Screen name="[recordId]/index" options={{ title: "Record details" }} />
      <Stack.Screen name="[recordId]/edit" options={{ title: "Correct record" }} />
      <Stack.Screen name="[recordId]/history" options={{ title: "Version history" }} />
    </Stack>
  );
}
