import { Stack } from "expo-router";

export default function AppGroupLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "#f7f4ec" },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#f7f4ec" },
        headerTintColor: "#1f2a24",
      }}
    />
  );
}
