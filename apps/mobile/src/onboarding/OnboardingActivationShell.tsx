import { useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { mobileObservability } from "../bootstrap/observability";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Typography } from "../components/ui/Typography";
import type { OnboardingActivationAdapter } from "./physical-validation";
import {
  type ActivationStep,
  activationProgress,
  completeActivationStep,
  createActivationState,
  isActivationComplete,
  milestoneForStep,
} from "./workflow";

type OnboardingActivationShellProps = {
  readonly adapter: OnboardingActivationAdapter;
  readonly platform: "android" | "ios";
};

const stepContent: Record<
  ActivationStep,
  { readonly action: string; readonly body: string; readonly title: string }
> = {
  account: {
    action: "Confirm synthetic account",
    body: "Use the named OFF-01 synthetic session. No email, provider response, token, or identity document enters this flow.",
    title: "Account checkpoint",
  },
  child: {
    action: "Create synthetic child",
    body: "Create Synthetic Parent and Synthetic Child atomically for India and Asia/Kolkata. No partial child is retained if the request fails.",
    title: "Child basics",
  },
  complete: {
    action: "Finish synthetic onboarding",
    body: "Verify one household, child, required consent set, enrolled device, and authoritative emergency-card version.",
    title: "Ready for Today",
  },
  consent: {
    action: "Accept required synthetic consent",
    body: "Acknowledge parent-notice-v1 and child-data-processing-v1. Optional AI and third-party vision processing remain separate and off.",
    title: "Notice and consent",
  },
  emergency: {
    action: "Create emergency basics",
    body: "Enroll protected local storage, then save one guardian contact. Blood group, critical notes, and pediatrician remain not provided; allergies and urgent medicines remain none confirmed.",
    title: "Emergency basics",
  },
  firstRecord: {
    action: "Preview synthetic first record",
    body: "Preview a fixed synthetic discharge-summary card. OFF-06 saves no record or file and grants no activation credit; real record creation begins in M3.",
    title: "First record preview",
  },
  privacy: {
    action: "Acknowledge privacy promise",
    body: "LittleArc keeps a child's essential history available offline. This evidence flow uses fixed synthetic values only and never permits real child or participant data.",
    title: "Calm access, clear boundaries",
  },
};

const safeErrorCopy: Record<ActivationStep, string> = {
  account: "The synthetic account checkpoint is unavailable. Try again.",
  child: "The atomic synthetic household could not be created. Nothing partial is kept.",
  complete: "Completion evidence is not ready. The prior confirmed steps remain available.",
  consent: "The required notice checkpoint could not continue. Try again.",
  emergency: "The protected emergency card could not be confirmed. Try again.",
  firstRecord: "The synthetic preview could not open. No record was created.",
  privacy: "The privacy checkpoint could not continue. Try again.",
};

export function OnboardingActivationShell({ adapter, platform }: OnboardingActivationShellProps) {
  const [state, setState] = useState(createActivationState);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const progress = activationProgress(state);
  const content = stepContent[state.current];
  const completed = isActivationComplete(state);
  const progressPercentage = `${Math.round((progress.current / progress.total) * 100)}%` as const;

  async function advance(): Promise<void> {
    const step = state.current;
    setWorking(true);
    setErrorMessage(undefined);
    try {
      await executeAdapterStep(adapter, step);
      mobileObservability.analytics.capture("onboarding_milestone_reached", {
        milestone: milestoneForStep(step),
        outcome: step === "firstRecord" ? "previewed" : "completed",
        platform,
      });
      setState((current) => completeActivationStep(current, step));
    } catch (error) {
      if (__DEV__) {
        console.warn(
          error instanceof Error ? error.message : `OFF-06 synthetic ${step} step failed.`,
        );
      }
      setErrorMessage(safeErrorCopy[step]);
    } finally {
      setWorking(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <View style={styles.heading}>
          <Typography accessibilityRole="header" textRole="screenTitle">
            Set up LittleArc
          </Typography>
          <Typography tone="secondary">
            One useful offline outcome before the wider product.
          </Typography>
        </View>

        <Banner
          message="Use only the fixed synthetic values shown here. Real parent, child, contact, and medical data remains blocked."
          title="OFF-06 synthetic evidence"
          variant="warning"
        />

        <View
          accessibilityLabel={`Onboarding step ${progress.current} of ${progress.total}`}
          accessibilityRole="progressbar"
          accessibilityValue={{
            max: progress.total,
            min: 1,
            now: progress.current,
            text: `Step ${progress.current} of ${progress.total}`,
          }}
          style={styles.progressTrack}
          testID="off06-progress"
        >
          <View style={[styles.progressFill, { width: progressPercentage }]} />
        </View>

        {errorMessage ? (
          <Banner
            actionLabel="Try this step again"
            message={errorMessage}
            onActionPress={() => void advance()}
            title="Onboarding paused safely"
            variant="danger"
          />
        ) : null}

        <View
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${content.title}. ${content.body}`}
          style={styles.panel}
        >
          <Typography textRole="caption" tone="muted">
            Step {progress.current} of {progress.total}
          </Typography>
          <Typography accessibilityRole="header" textRole="sectionTitle">
            {content.title}
          </Typography>
          <Typography>{content.body}</Typography>

          {state.current === "child" ? (
            <View style={styles.summary}>
              <SummaryRow label="Parent" value="Synthetic Parent" />
              <SummaryRow label="Child" value="Synthetic Child · 2020-01-01" />
              <SummaryRow label="Region" value="IN · Asia/Kolkata" />
            </View>
          ) : null}

          {state.current === "emergency" ? (
            <View style={styles.summary}>
              <SummaryRow label="Guardian" value="Synthetic Guardian" />
              <SummaryRow label="Allergies" value="None confirmed" />
              <SummaryRow label="Urgent medicines" value="None confirmed" />
              <SummaryRow label="Other optional details" value="Not provided" />
            </View>
          ) : null}

          {state.current === "firstRecord" ? (
            <View accessibilityLabel="Synthetic discharge summary preview" style={styles.preview}>
              <Typography textRole="cardTitle">Synthetic discharge summary</Typography>
              <Typography tone="secondary">
                Preview only · no file selected · no record created
              </Typography>
            </View>
          ) : null}

          {completed ? (
            <View
              accessibilityLabel="OFF-06 synthetic activation validation passed"
              accessibilityRole="summary"
              style={styles.success}
              testID="off06-summary"
            >
              <Typography textRole="cardTitle">Synthetic activation shell complete</Typography>
              <Typography>
                Account, consent, child, protected local enrollment, and emergency-card
                synchronization passed. The first-record item remained a preview.
              </Typography>
            </View>
          ) : (
            <Button
              label={content.action}
              loading={working}
              onPress={() => void advance()}
              testID={`off06-${state.current}`}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

async function executeAdapterStep(
  adapter: OnboardingActivationAdapter,
  step: ActivationStep,
): Promise<void> {
  switch (step) {
    case "account":
      await adapter.confirmAccount();
      return;
    case "child":
      await adapter.createHousehold();
      return;
    case "emergency":
      await adapter.createEmergencyCard();
      return;
    case "complete":
      await adapter.verifyCompletion();
      return;
    case "consent":
    case "firstRecord":
    case "privacy":
      return;
  }
}

function SummaryRow(props: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Typography textRole="caption" tone="muted">
        {props.label}
      </Typography>
      <Typography selectable textRole="bodyEmphasis">
        {props.value}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flexGrow: 1,
    padding: theme.layout.screenPadding,
  },
  content: {
    gap: theme.spacing.md,
    maxWidth: theme.layout.contentMaxWidth,
    paddingVertical: theme.spacing.lg,
    width: "100%",
  },
  heading: {
    gap: theme.spacing.xxs,
  },
  panel: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  preview: {
    backgroundColor: theme.colors.background.secondary,
    borderColor: theme.colors.border.subtle,
    borderCurve: "continuous",
    borderRadius: theme.radii.control,
    borderWidth: 1,
    gap: theme.spacing.xxs,
    padding: theme.spacing.md,
  },
  progressFill: {
    backgroundColor: theme.colors.action.primary,
    borderRadius: theme.radii.pill,
    height: "100%",
  },
  progressTrack: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.pill,
    height: theme.spacing.xs,
    overflow: "hidden",
    width: "100%",
  },
  success: {
    backgroundColor: theme.colors.record.confirmed,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.control,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  summary: {
    gap: theme.spacing.sm,
  },
  summaryRow: {
    gap: theme.spacing.xxs,
  },
}));
