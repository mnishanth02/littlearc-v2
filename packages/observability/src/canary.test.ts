import { describe, expect, it } from "vitest";
import { assertNoSensitiveCanary } from "./canary.js";
import { sensitiveCanaries } from "./test-canaries.js";

describe("sensitive canary scanner", () => {
  it("finds canaries in nested values and object keys", () => {
    expect(() =>
      assertNoSensitiveCanary(
        { safe: [{ nested: sensitiveCanaries[3].value }] },
        sensitiveCanaries,
      ),
    ).toThrow("ocr-text");

    expect(() =>
      assertNoSensitiveCanary(
        { [`unsafe-${sensitiveCanaries[4].value}`]: true },
        sensitiveCanaries,
      ),
    ).toThrow("token");
  });

  it("handles cyclic objects without leaking or recursing forever", () => {
    const value: { self?: unknown; safe: string } = { safe: "foundation" };
    value.self = value;

    expect(() => assertNoSensitiveCanary(value, sensitiveCanaries)).not.toThrow();
  });
});
