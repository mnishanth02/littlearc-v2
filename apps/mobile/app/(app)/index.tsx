import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMobileEnvironment } from "../../src/bootstrap/environment";

const landingSteps = [
  "Create a parent account",
  "Add one synthetic child profile",
  "Open emergency card offline",
] as const;

export default function LandingScreen() {
  const environment = getMobileEnvironment();

  return (
    <SafeAreaView style={styles.shell}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          LittleArc
        </Text>
        <Text style={styles.summary}>
          Synthetic M1 shell for proving the production-shaped app runtime.
        </Text>

        <View accessibilityLabel="Synthetic landing flow" style={styles.stepList}>
          {landingSteps.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View accessibilityLabel="Current runtime environment" style={styles.statusPanel}>
          <Text style={styles.statusLabel}>Environment</Text>
          <Text style={styles.statusValue}>{environment.appEnv}</Text>
          <Text style={styles.statusLabel}>API origin</Text>
          <Text style={styles.statusValue}>{environment.apiBaseUrl}</Text>
        </View>

        <Link accessibilityRole="button" href="/status" style={styles.primaryAction}>
          Open runtime status
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    maxWidth: 560,
    width: "100%",
  },
  primaryAction: {
    backgroundColor: "#1e5d4e",
    borderRadius: 8,
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    minHeight: 48,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 14,
    textAlign: "center",
  },
  shell: {
    alignItems: "center",
    backgroundColor: "#f7f4ec",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  statusLabel: {
    color: "#5d655a",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8d2c3",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  statusValue: {
    color: "#1f2a24",
    fontSize: 16,
    lineHeight: 24,
  },
  stepList: {
    gap: 10,
  },
  stepNumber: {
    backgroundColor: "#dbe8df",
    borderRadius: 16,
    color: "#1e5d4e",
    fontSize: 15,
    fontWeight: "700",
    height: 32,
    lineHeight: 32,
    textAlign: "center",
    width: 32,
  },
  stepRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  stepText: {
    color: "#29332d",
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
  },
  summary: {
    color: "#3f463d",
    fontSize: 18,
    lineHeight: 28,
  },
  title: {
    color: "#1f2a24",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 42,
  },
});
