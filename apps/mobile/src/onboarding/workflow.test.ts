import { describe, expect, it } from "vitest";
import {
  activationProgress,
  activationSteps,
  completeActivationStep,
  createActivationState,
  isActivationComplete,
  milestoneForStep,
} from "./workflow";

describe("OFF-06 activation workflow", () => {
  it("requires every activation checkpoint in order", () => {
    let state = createActivationState();

    for (const step of activationSteps) {
      expect(state.current).toBe(step);
      state = completeActivationStep(state, step);
    }

    expect(isActivationComplete(state)).toBe(true);
    expect(state.completed).toEqual(activationSteps);
  });

  it("rejects skipped and duplicate transitions", () => {
    const initial = createActivationState();

    expect(() => completeActivationStep(initial, "consent")).toThrow(
      "Cannot complete consent while privacy is active.",
    );
    const privacyComplete = completeActivationStep(initial, "privacy");
    expect(() => completeActivationStep(privacyComplete, "privacy")).toThrow(
      "Activation step privacy is already complete.",
    );
  });

  it("reports bounded progress and coarse milestone names", () => {
    const initial = createActivationState();
    expect(activationProgress(initial)).toEqual({ current: 1, total: 7 });
    expect(milestoneForStep("firstRecord")).toBe("first_record_preview");

    let state = initial;
    for (const step of activationSteps) {
      state = completeActivationStep(state, step);
    }
    expect(activationProgress(state)).toEqual({ current: 7, total: 7 });
  });
});
