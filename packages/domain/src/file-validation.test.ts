import { describe, expect, it } from "vitest";
import {
  canTransitionFileValidation,
  fileValidationSafeErrorCodes,
  fileValidationStates,
  isTerminalFileValidationState,
} from "./file-validation.js";

describe("file validation policy", () => {
  it("allows only cleanup-gated terminal transitions", () => {
    expect(canTransitionFileValidation("validating", "ready")).toBe(false);
    expect(canTransitionFileValidation("validating", "result_pending_cleanup")).toBe(true);
    expect(canTransitionFileValidation("result_pending_cleanup", "ready")).toBe(true);
    expect(canTransitionFileValidation("result_pending_cleanup", "rejected")).toBe(true);
    expect(canTransitionFileValidation("result_pending_cleanup", "failed")).toBe(true);
  });

  it("keeps automatic terminal states terminal", () => {
    expect(fileValidationStates.filter(isTerminalFileValidationState)).toEqual([
      "ready",
      "rejected",
      "failed",
    ]);
    expect(canTransitionFileValidation("ready", "queued")).toBe(false);
    expect(canTransitionFileValidation("rejected", "queued")).toBe(false);
    expect(canTransitionFileValidation("failed", "queued")).toBe(true);
  });

  it("uses a bounded safe error taxonomy", () => {
    expect(fileValidationSafeErrorCodes).toContain("malware_detected");
    expect(fileValidationSafeErrorCodes).not.toContain("filename");
    expect(new Set(fileValidationSafeErrorCodes).size).toBe(fileValidationSafeErrorCodes.length);
  });
});
