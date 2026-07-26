import {
  assertEmergencyCardContent,
  type ConfirmedList,
  type ConfirmedScalar,
  type EmergencyCardContent,
  type PediatricianContact,
} from "@littlearc/domain";
import type { ComponentProps } from "react";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Typography } from "../components/ui/Typography";

export function EmergencyCardEditor(props: {
  readonly initial: EmergencyCardContent;
  readonly onSave: (content: EmergencyCardContent) => Promise<void>;
}) {
  const [bloodGroup, setBloodGroup] = useState<ConfirmedScalar>(props.initial.bloodGroup);
  const [allergies, setAllergies] = useState<ConfirmedList>(props.initial.allergies);
  const [criticalNotes, setCriticalNotes] = useState<ConfirmedList>(props.initial.criticalNotes);
  const [urgentMedications, setUrgentMedications] = useState<ConfirmedList>(
    props.initial.urgentMedications,
  );
  const [guardianName, setGuardianName] = useState(props.initial.guardianContacts[0]?.name ?? "");
  const [guardianRelationship, setGuardianRelationship] = useState(
    props.initial.guardianContacts[0]?.relationship ?? "",
  );
  const [guardianPhone, setGuardianPhone] = useState(
    props.initial.guardianContacts[0]?.phone ?? "",
  );
  const [pediatrician, setPediatrician] = useState<PediatricianContact>(props.initial.pediatrician);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    const content: EmergencyCardContent = {
      ...props.initial,
      allergies,
      bloodGroup,
      criticalNotes,
      guardianContacts: [
        {
          name: guardianName.trim(),
          phone: guardianPhone.trim(),
          relationship: guardianRelationship.trim(),
        },
      ],
      pediatrician,
      urgentMedications,
    };
    try {
      assertEmergencyCardContent(content);
      setSaving(true);
      setError(undefined);
      await props.onSave(content);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The emergency card is invalid.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.content}>
      <Banner
        message="Only confirmed facts belong on this card. Choose Not provided or None confirmed explicitly when applicable."
        title="Confirm every state"
        variant="info"
      />
      <ScalarEditor
        label="Blood group"
        maximumLength={16}
        value={bloodGroup}
        onChange={setBloodGroup}
      />
      <ListEditor label="Allergies" value={allergies} onChange={setAllergies} />
      <ListEditor label="Critical health notes" value={criticalNotes} onChange={setCriticalNotes} />
      <ListEditor
        label="Urgent medication"
        value={urgentMedications}
        onChange={setUrgentMedications}
      />

      <View style={styles.fieldGroup}>
        <Typography accessibilityRole="header" textRole="sectionTitle">
          Guardian contact
        </Typography>
        <Input label="Name" value={guardianName} onChangeText={setGuardianName} />
        <Input
          label="Relationship"
          value={guardianRelationship}
          onChangeText={setGuardianRelationship}
        />
        <Input
          keyboardType="phone-pad"
          label="Phone in E.164 format"
          value={guardianPhone}
          onChangeText={setGuardianPhone}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Typography accessibilityRole="header" textRole="sectionTitle">
          Pediatrician
        </Typography>
        <View style={styles.choiceRow}>
          <Button
            label="Not provided"
            onPress={() => setPediatrician({ state: "notProvided" })}
            variant={pediatrician.state === "notProvided" ? "primary" : "secondary"}
          />
          <Button
            label="Confirmed contact"
            onPress={() =>
              setPediatrician(
                pediatrician.state === "confirmed"
                  ? pediatrician
                  : { name: "", phone: "", state: "confirmed" },
              )
            }
            variant={pediatrician.state === "confirmed" ? "primary" : "secondary"}
          />
        </View>
        {pediatrician.state === "confirmed" ? (
          <>
            <Input
              label="Pediatrician name"
              value={pediatrician.name}
              onChangeText={(name) => setPediatrician({ ...pediatrician, name })}
            />
            <Input
              keyboardType="phone-pad"
              label="Pediatrician phone in E.164 format"
              value={pediatrician.phone}
              onChangeText={(phone) => setPediatrician({ ...pediatrician, phone })}
            />
          </>
        ) : null}
      </View>

      {error ? <Banner message={error} title="Check the emergency card" variant="danger" /> : null}
      <Button
        label="Save encrypted update"
        loading={saving}
        onPress={() => void save()}
        testID="emergency-save"
      />
    </View>
  );
}

function ScalarEditor(props: {
  readonly label: string;
  readonly maximumLength: number;
  readonly onChange: (value: ConfirmedScalar) => void;
  readonly value: ConfirmedScalar;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Typography accessibilityRole="header" textRole="sectionTitle">
        {props.label}
      </Typography>
      <View style={styles.choiceRow}>
        <Button
          label="Not provided"
          onPress={() => props.onChange({ state: "notProvided" })}
          variant={props.value.state === "notProvided" ? "primary" : "secondary"}
        />
        <Button
          label="Confirmed value"
          onPress={() =>
            props.onChange(
              props.value.state === "confirmed" ? props.value : { state: "confirmed", value: "" },
            )
          }
          variant={props.value.state === "confirmed" ? "primary" : "secondary"}
        />
      </View>
      {props.value.state === "confirmed" ? (
        <Input
          label={`${props.label} confirmed value`}
          maxLength={props.maximumLength}
          value={props.value.value}
          onChangeText={(value) => props.onChange({ state: "confirmed", value })}
        />
      ) : null}
    </View>
  );
}

function ListEditor(props: {
  readonly label: string;
  readonly onChange: (value: ConfirmedList) => void;
  readonly value: ConfirmedList;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Typography accessibilityRole="header" textRole="sectionTitle">
        {props.label}
      </Typography>
      <View style={styles.choiceRow}>
        <Button
          label="Not provided"
          onPress={() => props.onChange({ state: "notProvided" })}
          variant={props.value.state === "notProvided" ? "primary" : "secondary"}
        />
        <Button
          label="None confirmed"
          onPress={() => props.onChange({ state: "noneConfirmed" })}
          variant={props.value.state === "noneConfirmed" ? "primary" : "secondary"}
        />
        <Button
          label="Confirmed values"
          onPress={() =>
            props.onChange(
              props.value.state === "confirmed"
                ? props.value
                : { state: "confirmed", values: [""] },
            )
          }
          variant={props.value.state === "confirmed" ? "primary" : "secondary"}
        />
      </View>
      {props.value.state === "confirmed" ? (
        <Input
          label={`${props.label}, comma separated`}
          multiline
          value={props.value.values.join(", ")}
          onChangeText={(value) =>
            props.onChange({
              state: "confirmed",
              values: value.split(",").map((item) => item.trim()),
            })
          }
        />
      ) : null}
    </View>
  );
}

function Input(props: ComponentProps<typeof TextInput> & { readonly label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.inputGroup}>
      <Typography textRole="label">{label}</Typography>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        placeholderTextColor={styles.placeholder.color}
        style={[styles.input, props.multiline && styles.multiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  fieldGroup: {
    gap: theme.spacing.sm,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  inputGroup: {
    gap: theme.spacing.xxs,
  },
  input: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.control,
    borderWidth: 1,
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    minHeight: theme.touchTargets.minimum,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  multiline: {
    minHeight: theme.touchTargets.minimum * 2,
    textAlignVertical: "top",
  },
  placeholder: {
    color: theme.colors.text.muted,
  },
}));
