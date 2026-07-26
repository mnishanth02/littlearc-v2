import type { OnboardingMilestone } from "@littlearc/observability";

export const activationSteps = [
  "privacy",
  "account",
  "consent",
  "child",
  "emergency",
  "firstRecord",
  "complete",
] as const;

export type ActivationStep = (typeof activationSteps)[number];

export type ActivationState = {
  readonly completed: ReadonlyArray<ActivationStep>;
  readonly current: ActivationStep;
};

const milestones: Record<ActivationStep, OnboardingMilestone> = {
  account: "account_ready",
  child: "child_created",
  complete: "onboarding_completed",
  consent: "consent_accepted",
  emergency: "emergency_card_synced",
  firstRecord: "first_record_preview",
  privacy: "privacy_promise",
};

export function createActivationState(): ActivationState {
  return { completed: [], current: "privacy" };
}

export function completeActivationStep(
  state: ActivationState,
  step: ActivationStep,
): ActivationState {
  if (state.completed.includes(step)) {
    throw new Error(`Activation step ${step} is already complete.`);
  }
  if (step !== state.current) {
    throw new Error(`Cannot complete ${step} while ${state.current} is active.`);
  }
  const currentIndex = activationSteps.indexOf(step);
  const next = activationSteps[currentIndex + 1];
  if (!next) {
    return { completed: [...state.completed, step], current: step };
  }
  return { completed: [...state.completed, step], current: next };
}

export function activationProgress(state: ActivationState): {
  readonly current: number;
  readonly total: number;
} {
  return {
    current: Math.min(state.completed.length + 1, activationSteps.length),
    total: activationSteps.length,
  };
}

export function milestoneForStep(step: ActivationStep): OnboardingMilestone {
  return milestones[step];
}

export function isActivationComplete(state: ActivationState): boolean {
  return state.current === "complete" && state.completed.includes("complete");
}
