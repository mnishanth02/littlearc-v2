import type { ComponentProps } from "react";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Typography } from "../components/ui/Typography";
import {
  buildConfirmedManualRecord,
  type ConfirmedManualRecord,
  type ManualRecordFormValues,
  manualRecordCategories,
  manualRecordCategoryLabel,
} from "./form";

export function ManualRecordEditor(props: {
  readonly initial: ManualRecordFormValues;
  readonly mode: "create" | "correct";
  readonly onConfirm: (
    confirmed: ConfirmedManualRecord,
    form: ManualRecordFormValues,
  ) => Promise<void>;
  readonly onDiscard: () => Promise<void>;
  readonly onSaveDraft: (form: ManualRecordFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState(props.initial);
  const [busy, setBusy] = useState<"confirm" | "discard" | "draft">();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  function update<Key extends keyof ManualRecordFormValues>(
    key: Key,
    value: ManualRecordFormValues[Key],
  ) {
    setSaved(false);
    setConfirmingDiscard(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function run(kind: "confirm" | "discard" | "draft", task: () => Promise<void>) {
    try {
      setBusy(kind);
      setError(undefined);
      await task();
      if (kind === "draft") {
        setSaved(true);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The record action could not finish.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <View style={styles.content}>
      <Banner
        message="Enter only facts you can confirm from your own information. LittleArc does not infer diagnoses, calculate dosage, or verify a provider record."
        title="Manual entry"
        variant="info"
      />

      {props.mode === "create" ? (
        <View style={styles.fieldGroup}>
          <Typography accessibilityRole="header" textRole="sectionTitle">
            Record type
          </Typography>
          <View style={styles.choiceRow}>
            {manualRecordCategories.map((category) => (
              <Button
                key={category}
                label={manualRecordCategoryLabel(category)}
                onPress={() => setForm(emptyCategory(form, category))}
                testID={`record-category-${category}`}
                variant={form.category === category ? "primary" : "secondary"}
              />
            ))}
          </View>
        </View>
      ) : (
        <Banner
          message={`Correcting ${manualRecordCategoryLabel(form.category)}. Saving creates a new version and keeps prior history.`}
          title="Correction"
          variant="warning"
        />
      )}

      <Input
        label="Title"
        maxLength={160}
        onChangeText={(value) => update("title", value)}
        value={form.title}
      />
      <Input
        label="Event or document date (YYYY-MM-DD), optional"
        onChangeText={(value) => update("eventDate", value)}
        value={form.eventDate}
      />
      <Input
        label="Provider or facility, optional"
        maxLength={160}
        onChangeText={(value) => update("providerFacility", value)}
        value={form.providerFacility}
      />

      {form.category === "document" ? (
        <Input
          label="Document kind, optional"
          maxLength={120}
          onChangeText={(value) => update("documentKind", value)}
          value={form.documentKind}
        />
      ) : null}

      {form.category === "vaccination" ? (
        <View style={styles.fieldGroup}>
          <Banner
            message="If you enter a date, choose whether it is a due date or a given date. Confirm vaccination schedules with a qualified provider."
            title="Date meaning matters"
            variant="warning"
          />
          <Input
            label="Vaccine name"
            maxLength={160}
            onChangeText={(value) => update("vaccineName", value)}
            value={form.vaccineName}
          />
          <View style={styles.choiceRow}>
            <Button
              label="Date not provided"
              onPress={() => update("vaccinationDateMeaning", "")}
              variant={form.vaccinationDateMeaning === "" ? "primary" : "secondary"}
            />
            <Button
              label="Due date"
              onPress={() => update("vaccinationDateMeaning", "due")}
              variant={form.vaccinationDateMeaning === "due" ? "primary" : "secondary"}
            />
            <Button
              label="Given date"
              onPress={() => update("vaccinationDateMeaning", "given")}
              variant={form.vaccinationDateMeaning === "given" ? "primary" : "secondary"}
            />
          </View>
          <Input
            label="Batch or lot, optional"
            maxLength={120}
            onChangeText={(value) => update("batchLot", value)}
            value={form.batchLot}
          />
        </View>
      ) : null}

      {form.category === "doctor_visit" ? (
        <View style={styles.fieldGroup}>
          <Input
            label="Reason for visit"
            maxLength={500}
            multiline
            onChangeText={(value) => update("reasonForVisit", value)}
            value={form.reasonForVisit}
          />
          <Input
            label="Follow-up date (YYYY-MM-DD), optional"
            onChangeText={(value) => update("followUpDate", value)}
            value={form.followUpDate}
          />
          <Input
            label="Tags, optional"
            maxLength={240}
            onChangeText={(value) => update("tags", value)}
            value={form.tags}
          />
        </View>
      ) : null}

      {form.category === "prescription" ? (
        <View style={styles.fieldGroup}>
          <Banner
            message="Copy medicine names and written instructions exactly. LittleArc does not alter instructions or calculate dosage."
            title="Preserve the source wording"
            variant="warning"
          />
          <Input
            label="Medicines as confirmed text"
            maxLength={1_000}
            multiline
            onChangeText={(value) => update("medicines", value)}
            value={form.medicines}
          />
          <Input
            label="Written schedule or instructions, optional"
            maxLength={1_000}
            multiline
            onChangeText={(value) => update("writtenSchedule", value)}
            value={form.writtenSchedule}
          />
          <Input
            label="Duration, optional"
            maxLength={160}
            onChangeText={(value) => update("duration", value)}
            value={form.duration}
          />
          <Input
            label="End date (YYYY-MM-DD), optional"
            onChangeText={(value) => update("endDate", value)}
            value={form.endDate}
          />
        </View>
      ) : null}

      <Input
        label="Parent notes, optional"
        maxLength={2_000}
        multiline
        onChangeText={(value) => update("notes", value)}
        value={form.notes}
      />

      {saved ? (
        <Banner
          message="This draft is encrypted on this device and has not been confirmed or synchronized."
          title="Draft saved"
          variant="success"
        />
      ) : null}
      {error ? <Banner message={error} title="Check this record" variant="danger" /> : null}
      <View style={styles.actions}>
        <Button
          label="Save encrypted draft"
          loading={busy === "draft"}
          onPress={() => void run("draft", () => props.onSaveDraft(form))}
          testID="record-save-draft"
          variant="secondary"
        />
        <Button
          label={props.mode === "create" ? "Confirm record" : "Confirm correction"}
          loading={busy === "confirm"}
          onPress={() =>
            void run("confirm", () => props.onConfirm(buildConfirmedManualRecord(form), form))
          }
          testID="record-confirm"
        />
        <Button
          label={confirmingDiscard ? "Confirm discard draft" : "Discard draft"}
          loading={busy === "discard"}
          onPress={() => {
            if (!confirmingDiscard) {
              setConfirmingDiscard(true);
              return;
            }
            void run("discard", props.onDiscard);
          }}
          testID={confirmingDiscard ? "record-confirm-discard-draft" : "record-discard-draft"}
          variant="secondary"
        />
      </View>
    </View>
  );
}

function emptyCategory(
  current: ManualRecordFormValues,
  category: ManualRecordFormValues["category"],
): ManualRecordFormValues {
  return {
    batchLot: "",
    category,
    documentKind: "",
    duration: "",
    endDate: "",
    eventDate: current.eventDate,
    followUpDate: "",
    medicines: "",
    notes: current.notes,
    providerFacility: current.providerFacility,
    reasonForVisit: "",
    tags: "",
    title: current.title,
    vaccinationDateMeaning: "",
    vaccineName: "",
    writtenSchedule: "",
  };
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
  actions: {
    gap: theme.spacing.xs,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  content: {
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  fieldGroup: {
    gap: theme.spacing.sm,
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
  inputGroup: {
    gap: theme.spacing.xxs,
  },
  multiline: {
    minHeight: theme.touchTargets.minimum * 2,
    textAlignVertical: "top",
  },
  placeholder: {
    color: theme.colors.text.muted,
  },
}));
