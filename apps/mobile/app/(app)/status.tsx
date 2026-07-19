import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMobileEnvironment } from "../../src/bootstrap/environment";

const runtimeChecks = [
  { label: "Expo development client", status: "configured" },
  { label: "Expo Router groups", status: "configured" },
  { label: "SQLCipher plugin", status: "configured" },
  { label: "Scanner and OCR modules", status: "configured" },
  { label: "Physical-device acceptance", status: "deferred" },
] as const;

export default function RuntimeStatusScreen() {
  const environment = getMobileEnvironment();

  return (
    <SafeAreaView style={styles.shell}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Runtime status
        </Text>
        <Text style={styles.summary}>
          FND-03 confirms that the mobile shell is configured for synthetic local work.
        </Text>
        <View style={styles.statusPanel}>
          <Text style={styles.statusLabel}>Environment</Text>
          <Text style={styles.statusValue}>{environment.appEnv}</Text>
          <Text style={styles.statusLabel}>API origin</Text>
          <Text style={styles.statusValue}>{environment.apiBaseUrl}</Text>
        </View>
        <View accessibilityLabel="Mobile runtime checks" style={styles.checkList}>
          {runtimeChecks.map((check) => (
            <View key={check.label} style={styles.checkRow}>
              <Text style={styles.checkLabel}>{check.label}</Text>
              <Text style={styles.checkStatus}>{check.status}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  checkLabel: {
    color: "#29332d",
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  checkList: {
    gap: 8,
  },
  checkRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8d2c3",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 52,
    padding: 14,
  },
  checkStatus: {
    color: "#1e5d4e",
    fontSize: 14,
    fontWeight: "700",
  },
  content: {
    gap: 18,
    maxWidth: 560,
    width: "100%",
  },
  shell: {
    alignItems: "center",
    backgroundColor: "#f7f4ec",
    flex: 1,
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
  summary: {
    color: "#3f463d",
    fontSize: 17,
    lineHeight: 26,
  },
  title: {
    color: "#1f2a24",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 38,
  },
});
