import { createUuidV7, type EmergencyCardContent } from "@littlearc/domain";
import { getRandomBytes } from "expo-crypto";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../../src/components/ui/Banner";
import { EmergencyCardEditor } from "../../src/emergency-card/EmergencyCardEditor";
import { withUnlockedLocalDatabase } from "../../src/local-security/native";
import {
  queueEmergencyCardUpdate,
  readLocalChildProfile,
  readLocalEmergencyCard,
} from "../../src/sync/repository";

type EditorState =
  | { readonly kind: "loading" }
  | {
      readonly cardId: string;
      readonly childId: string;
      readonly content: EmergencyCardContent;
      readonly kind: "ready";
    }
  | { readonly kind: "unavailable" };

export default function EmergencyEditScreen() {
  const router = useRouter();
  const generatedCardId = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const [state, setState] = useState<EditorState>({ kind: "loading" });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadEditor(generatedCardId).then((next) => {
        if (active) {
          setState(next);
        }
      });
      return () => {
        active = false;
      };
    }, [generatedCardId]),
  );

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      {state.kind === "loading" ? (
        <Banner message="Unlocking encrypted information…" title="Loading" variant="info" />
      ) : null}
      {state.kind === "unavailable" ? (
        <Banner
          message="An enrolled local child profile is required before emergency-card setup."
          title="Setup unavailable"
          variant="warning"
        />
      ) : null}
      {state.kind === "ready" ? (
        <EmergencyCardEditor
          initial={state.content}
          onSave={async (content) => {
            await withUnlockedLocalDatabase((database) =>
              queueEmergencyCardUpdate(database, {
                cardId: state.cardId,
                childId: state.childId,
                content,
                idempotencyKey: createUuidV7(getRandomBytes(10)),
                localDependencyIds: [],
                mutationId: createUuidV7(getRandomBytes(10)),
                now: new Date().toISOString(),
              }),
            );
            router.replace("/emergency");
          }}
        />
      ) : null}
    </ScrollView>
  );
}

async function loadEditor(generatedCardId: string): Promise<EditorState> {
  return withUnlockedLocalDatabase(async (database) => {
    const identifiers = await database.getFirstAsync<{
      readonly cardId: string | null;
      readonly childId: string | null;
    }>(
      `select
        (select card_id from local_emergency_cards where card_id is not null limit 1) as "cardId",
        (select child_id from local_children where deleted_at is null limit 1) as "childId"`,
    );
    if (!identifiers?.childId) {
      return { kind: "unavailable" };
    }
    const card = identifiers.cardId
      ? await readLocalEmergencyCard(database, identifiers.cardId)
      : null;
    if (card) {
      return {
        cardId: card.cardId,
        childId: card.childId,
        content: card.content,
        kind: "ready",
      };
    }
    const child = await readLocalChildProfile(database, identifiers.childId);
    if (!child) {
      return { kind: "unavailable" };
    }
    return {
      cardId: generatedCardId,
      childId: child.childId,
      content: {
        allergies: { state: "notProvided" },
        bloodGroup: { state: "notProvided" },
        criticalNotes: { state: "notProvided" },
        dateOfBirth: child.dateOfBirth,
        guardianContacts: [{ name: "", phone: "", relationship: "" }],
        pediatrician: { state: "notProvided" },
        preferredName: child.preferredName,
        urgentMedications: { state: "notProvided" },
      },
      kind: "ready",
    };
  });
}

const styles = StyleSheet.create((theme) => ({
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flexGrow: 1,
    padding: theme.layout.screenPadding,
    paddingVertical: theme.spacing.lg,
  },
}));
