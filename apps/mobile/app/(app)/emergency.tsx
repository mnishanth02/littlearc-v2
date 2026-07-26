import * as Network from "expo-network";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";
import { EmergencyCardView } from "../../src/emergency-card/EmergencyCardView";
import { emergencyDialerUrl } from "../../src/emergency-card/presentation";
import { withUnlockedLocalDatabase } from "../../src/local-security/native";
import { type LocalEmergencyCard, readLocalEmergencyCard } from "../../src/sync/repository";

type ScreenState =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly card: LocalEmergencyCard; readonly kind: "ready"; readonly offline: boolean }
  | { readonly kind: "error"; readonly message: string };

export default function EmergencyScreen() {
  const router = useRouter();
  const [state, setState] = useState<ScreenState>({ kind: "loading" });
  const requestCard = useCallback((isActive: () => boolean = () => true) => {
    void loadEmergencyCard()
      .then((next) => {
        if (isActive()) {
          setState(next);
        }
      })
      .catch((error: unknown) => {
        if (isActive()) {
          setState(toErrorState(error));
        }
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      requestCard(() => active);
      return () => {
        active = false;
      };
    }, [requestCard]),
  );

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      {state.kind === "loading" ? (
        <View style={styles.content}>
          <Typography accessibilityRole="header" textRole="screenTitle">
            Emergency card
          </Typography>
          <Typography accessibilityLiveRegion="polite">Unlocking encrypted information…</Typography>
        </View>
      ) : null}
      {state.kind === "unavailable" ? (
        <View style={styles.content}>
          <Typography accessibilityRole="header" textRole="screenTitle">
            Emergency card
          </Typography>
          <Banner
            message="No confirmed emergency card is stored on this enrolled device yet. Connect and complete emergency-card setup first."
            title="Not available offline"
            variant="warning"
          />
        </View>
      ) : null}
      {state.kind === "error" ? (
        <View style={styles.content}>
          <Typography accessibilityRole="header" textRole="screenTitle">
            Emergency card
          </Typography>
          <Banner message={state.message} title="Encrypted card unavailable" variant="danger" />
          <Button
            label="Try again"
            onPress={() => {
              setState({ kind: "loading" });
              requestCard();
            }}
          />
        </View>
      ) : null}
      {state.kind === "ready" ? (
        <EmergencyCardView
          card={state.card}
          offline={state.offline}
          onCall={(phone) => void Linking.openURL(emergencyDialerUrl(phone))}
          onEdit={() => router.push("/emergency-edit")}
        />
      ) : null}
    </ScrollView>
  );
}

function toErrorState(error: unknown): ScreenState {
  return {
    kind: "error",
    message:
      error instanceof Error
        ? error.message
        : "Emergency information is unavailable on this device.",
  };
}

async function loadEmergencyCard(): Promise<ScreenState> {
  const [card, network] = await Promise.all([
    withUnlockedLocalDatabase(async (database) => {
      const identifier = await database.getFirstAsync<{ readonly cardId: string | null }>(
        `select card_id as "cardId" from local_emergency_cards
         where card_id is not null and deleted_at is null limit 1`,
      );
      return identifier?.cardId ? readLocalEmergencyCard(database, identifier.cardId) : null;
    }),
    Network.getNetworkStateAsync(),
  ]);
  if (!card) {
    return { kind: "unavailable" };
  }
  return { card, kind: "ready", offline: network.isConnected !== true };
}

const styles = StyleSheet.create((theme) => ({
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flexGrow: 1,
    padding: theme.layout.screenPadding,
    paddingVertical: theme.spacing.lg,
  },
  content: {
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
}));
