import type { PediatricianContact } from "@littlearc/domain";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Typography } from "../components/ui/Typography";
import type { LocalEmergencyCard } from "../sync/repository";
import { emergencyAgeLabel, listStateLabel, scalarStateLabel } from "./presentation";

export function EmergencyCardView(props: {
  readonly card: LocalEmergencyCard;
  readonly offline: boolean;
  readonly onCall: (phone: string) => void;
  readonly onEdit: () => void;
}) {
  const { card } = props;
  return (
    <View style={styles.content} testID="emergency-card-content">
      <View accessibilityRole="summary" style={styles.hero}>
        <Typography accessibilityRole="header" selectable textRole="display">
          {card.content.preferredName}
        </Typography>
        <Typography selectable textRole="bodyEmphasis" tone="secondary">
          {emergencyAgeLabel(card.content.dateOfBirth)}
        </Typography>
      </View>

      <Banner
        message={
          props.offline
            ? "Showing the last confirmed encrypted copy stored on this device."
            : "Showing the confirmed encrypted copy stored on this device."
        }
        title={props.offline ? "Available offline" : "Stored for offline access"}
        variant={props.offline ? "warning" : "info"}
      />

      <View accessibilityLabel="Confirmed emergency facts" style={styles.factGrid}>
        <Fact label="Blood group" value={scalarStateLabel(card.content.bloodGroup)} />
        <Fact label="Allergies" value={listStateLabel(card.content.allergies)} />
        <Fact label="Critical health notes" value={listStateLabel(card.content.criticalNotes)} />
        <Fact label="Urgent medication" value={listStateLabel(card.content.urgentMedications)} />
      </View>

      <View style={styles.section}>
        <Typography accessibilityRole="header" textRole="sectionTitle">
          Emergency contacts
        </Typography>
        {card.content.guardianContacts.map((contact) => (
          <View key={`${contact.name}:${contact.phone}`} style={styles.contact}>
            <View style={styles.contactCopy}>
              <Typography selectable textRole="bodyEmphasis">
                {contact.name}
              </Typography>
              <Typography selectable tone="secondary">
                {contact.relationship} · {contact.phone}
              </Typography>
            </View>
            <Button
              accessibilityHint="Opens the phone dialer without placing a call"
              label={`Open dialer for ${contact.name}`}
              onPress={() => props.onCall(contact.phone)}
              testID="emergency-call-guardian"
              variant="secondary"
            />
          </View>
        ))}
      </View>

      <Pediatrician contact={card.content.pediatrician} onCall={props.onCall} />

      {card.syncStatus === "conflict" ? (
        <Banner
          message="Another confirmed version is available. Review both versions before replacing critical facts."
          title="Changes need review"
          variant="warning"
        />
      ) : null}
      {card.syncStatus === "pending" ? (
        <Banner
          message="Your encrypted edit is saved on this device and will synchronize after reconnecting."
          title="Update waiting to sync"
          variant="info"
        />
      ) : null}

      <View style={styles.metadata}>
        <Typography selectable textRole="caption" tone="muted">
          Last confirmed {new Date(card.updatedAt).toLocaleString()} · version {card.version}
        </Typography>
        <Typography textRole="caption" tone="muted">
          Standard access · app unlock required
        </Typography>
      </View>

      <Button label="Edit emergency card" onPress={props.onEdit} testID="emergency-edit" />
    </View>
  );
}

function Fact(props: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.fact}>
      <Typography textRole="caption" tone="muted">
        {props.label}
      </Typography>
      <Typography selectable textRole="bodyEmphasis">
        {props.value}
      </Typography>
    </View>
  );
}

function Pediatrician(props: {
  readonly contact: PediatricianContact;
  readonly onCall: (phone: string) => void;
}) {
  const confirmed = props.contact.state === "confirmed" ? props.contact : null;
  return (
    <View style={styles.section}>
      <Typography accessibilityRole="header" textRole="sectionTitle">
        Pediatrician
      </Typography>
      {!confirmed ? (
        <Typography selectable>Not provided</Typography>
      ) : (
        <View style={styles.contact}>
          <View style={styles.contactCopy}>
            <Typography selectable textRole="bodyEmphasis">
              {confirmed.name}
            </Typography>
            <Typography selectable tone="secondary">
              {confirmed.phone}
            </Typography>
          </View>
          <Button
            accessibilityHint="Opens the phone dialer without placing a call"
            label={`Open dialer for ${confirmed.name}`}
            onPress={() => props.onCall(confirmed.phone)}
            testID="emergency-call-pediatrician"
            variant="secondary"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  hero: {
    gap: theme.spacing.xxs,
  },
  factGrid: {
    gap: theme.spacing.sm,
  },
  fact: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.xxs,
    padding: theme.spacing.md,
  },
  section: {
    gap: theme.spacing.sm,
  },
  contact: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  contactCopy: {
    gap: theme.spacing.xxs,
  },
  metadata: {
    gap: theme.spacing.xxs,
  },
}));
