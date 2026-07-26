import { describe, expect, it } from "vitest";
import {
  emergencyAgeLabel,
  emergencyDialerUrl,
  listStateLabel,
  scalarStateLabel,
} from "./presentation";

describe("OFF-05 emergency-card presentation", () => {
  it("keeps not-provided and none-confirmed states distinct", () => {
    expect(scalarStateLabel({ state: "notProvided" })).toBe("Not provided");
    expect(listStateLabel({ state: "notProvided" })).toBe("Not provided");
    expect(listStateLabel({ state: "noneConfirmed" })).toBe("None confirmed");
    expect(listStateLabel({ state: "confirmed", values: ["Synthetic allergy"] })).toBe(
      "Synthetic allergy",
    );
  });

  it("formats age and validated dialer URLs", () => {
    expect(emergencyAgeLabel("2020-07-23", new Date("2026-07-22T12:00:00.000Z"))).toBe(
      "5 years old",
    );
    expect(emergencyDialerUrl("+919999999999")).toBe("tel:+919999999999");
  });
});
