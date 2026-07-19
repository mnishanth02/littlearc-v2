import { useRouter } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "../src/components/ui/Button";
import { Typography } from "../src/components/ui/Typography";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.shell}>
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="screenTitle">
          Screen unavailable
        </Typography>
        <Typography tone="secondary">
          This route is not part of the current synthetic application skeleton.
        </Typography>
        <Button label="Return to LittleArc" onPress={() => router.replace("/")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.spacing.md,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flex: 1,
    justifyContent: "center",
    padding: theme.layout.screenPadding,
  },
}));
