import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable as NativePressable,
  SafeAreaView as NativeSafeAreaView,
  ScrollView as NativeScrollView,
  Text as NativeText,
  View as NativeView,
} from 'react-native';
import { createUnistylesElement, StyleSheet } from 'react-native-unistyles';

import {
  probeBiometrics,
  probeCrypto,
  probeImageImport,
  probeImport,
  probeLocalNotification,
  probeRuntime,
  probeSQLCipher,
  probeScannerAndOCR,
  runProbe,
  type ProbeResult,
} from './src/checks';

const Pressable = createUnistylesElement(NativePressable);
const SafeAreaView = createUnistylesElement(NativeSafeAreaView);
const ScrollView = createUnistylesElement(NativeScrollView);
const Text = createUnistylesElement(NativeText);
const View = createUnistylesElement(NativeView);

type ProbeStatus =
  | { state: 'idle' }
  | { state: 'running' }
  | { state: 'passed'; result: ProbeResult }
  | { state: 'failed'; error: string };

type ProbeDefinition = {
  id: string;
  title: string;
  description: string;
  run: () => Promise<ProbeResult>;
};

const probes: ProbeDefinition[] = [
  {
    id: 'runtime',
    title: 'Development runtime and auth client',
    description: 'Checks Expo runtime, deep-link callback shape, and Better Auth client initialization.',
    run: probeRuntime,
  },
  {
    id: 'crypto',
    title: 'AES-256-GCM',
    description: 'Runs a synthetic round trip and verifies mismatched additional data is rejected.',
    run: probeCrypto,
  },
  {
    id: 'sqlcipher',
    title: 'SQLCipher database',
    description: 'Checks cipher activation, WAL, migration, and a synthetic write/read round trip.',
    run: probeSQLCipher,
  },
  {
    id: 'biometrics',
    title: 'Biometrics and protected key storage',
    description: 'Inspects enrollment and runs a protected SecureStore round trip where supported.',
    run: probeBiometrics,
  },
  {
    id: 'scanner-ocr',
    title: 'Multi-page scanner and offline OCR',
    description: 'Scans a synthetic document and records only page, block, and character counts.',
    run: probeScannerAndOCR,
  },
  {
    id: 'document-import',
    title: 'PDF and image document import',
    description: 'Checks app-readable copies from the native document picker.',
    run: probeImport,
  },
  {
    id: 'image-import',
    title: 'Photo-library import',
    description: 'Checks permission and multi-image selection without retaining content.',
    run: probeImageImport,
  },
  {
    id: 'notification',
    title: 'Privacy-safe local notification',
    description: 'Schedules generic copy and a non-sensitive authenticated route hint.',
    run: probeLocalNotification,
  },
];

function ProbeCard({ probe }: { probe: ProbeDefinition }) {
  const [status, setStatus] = useState<ProbeStatus>({ state: 'idle' });

  const execute = async () => {
    setStatus({ state: 'running' });
    const outcome = await runProbe(probe.run);
    if (outcome.result) {
      setStatus({ state: 'passed', result: outcome.result });
    } else {
      setStatus({ state: 'failed', error: outcome.error ?? 'Unknown probe failure.' });
    }
  };

  return (
    <View style={styles.card} testID={`probe-card-${probe.id}`}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {probe.title}
      </Text>
      <Text style={styles.description}>{probe.description}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: status.state === 'running', disabled: status.state === 'running' }}
        disabled={status.state === 'running'}
        onPress={execute}
        style={styles.button}
        testID={`probe-run-${probe.id}`}
      >
        {status.state === 'running' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonLabel}>Run probe</Text>
        )}
      </Pressable>
      {status.state === 'passed' ? (
        <View
          accessibilityLabel={`Probe completed. ${status.result.summary}`}
          accessibilityLiveRegion="polite"
          accessible
          style={styles.resultSuccess}
          testID={`probe-result-${probe.id}`}
        >
          <Text style={styles.resultTitle}>Probe completed</Text>
          <Text style={styles.resultText}>{status.result.summary}</Text>
          {status.result.details ? (
            <Text selectable style={styles.details}>
              {JSON.stringify(status.result.details, null, 2)}
            </Text>
          ) : null}
          {status.result.followUp ? <Text style={styles.followUp}>{status.result.followUp}</Text> : null}
        </View>
      ) : null}
      {status.state === 'failed' ? (
        <View
          accessibilityLabel={`Probe failed. ${status.error}`}
          accessibilityLiveRegion="assertive"
          accessible
          style={styles.resultFailure}
          testID={`probe-result-${probe.id}`}
        >
          <Text style={styles.resultTitle}>Probe failed</Text>
          <Text selectable style={styles.resultText}>
            {status.error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          LittleArc M0 Native Compatibility
        </Text>
        <Text style={styles.intro}>
          Synthetic evidence only. This disposable development client is not a production application and
          must not receive personal or child data.
        </Text>
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            A completed probe is evidence from this device only. Copy the aggregate result into the M0
            dossier; never copy recognized document content or credentials.
          </Text>
        </View>
        {probes.map((probe) => (
          <ProbeCard key={probe.id} probe={probe} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safeArea: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.medium,
    maxWidth: 760,
    padding: theme.spacing.medium,
    paddingBottom: 64,
    width: '100%',
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
  },
  intro: {
    color: theme.colors.secondaryText,
    fontSize: 16,
    lineHeight: 24,
  },
  warning: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.warning,
    borderLeftWidth: 5,
    borderRadius: 12,
    padding: theme.spacing.medium,
  },
  warningText: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: theme.spacing.small,
    padding: theme.spacing.medium,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 25,
  },
  description: {
    color: theme.colors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.action,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 128,
    paddingHorizontal: theme.spacing.medium,
  },
  buttonLabel: {
    color: theme.colors.actionText,
    fontSize: 16,
    fontWeight: '600',
  },
  resultSuccess: {
    borderColor: theme.colors.success,
    borderLeftWidth: 4,
    gap: 6,
    marginTop: theme.spacing.small,
    paddingLeft: 12,
  },
  resultFailure: {
    borderColor: theme.colors.danger,
    borderLeftWidth: 4,
    gap: 6,
    marginTop: theme.spacing.small,
    paddingLeft: 12,
  },
  resultTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  resultText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  details: {
    color: theme.colors.secondaryText,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  followUp: {
    color: theme.colors.secondaryText,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
  },
}));
