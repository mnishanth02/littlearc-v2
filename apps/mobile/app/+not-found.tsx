import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.shell}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Screen unavailable
        </Text>
        <Text style={styles.body}>
          This route is not part of the current synthetic application skeleton.
        </Text>
        <Link accessibilityRole="link" href="/" style={styles.link}>
          Return to LittleArc
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: "#3f463d",
    fontSize: 16,
    lineHeight: 24,
  },
  content: {
    gap: 16,
    maxWidth: 520,
    width: "100%",
  },
  link: {
    color: "#1e5d4e",
    fontSize: 16,
    fontWeight: "700",
    minHeight: 44,
    paddingVertical: 10,
  },
  shell: {
    alignItems: "center",
    backgroundColor: "#f7f4ec",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#1f2a24",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
  },
});
