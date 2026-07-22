import { describe, expect, it } from "vitest";
import {
  localAppLockPolicy,
  parseLocalEnrollmentMarker,
  resolveLocalSecurityState,
  runSignOutWithLocalWipe,
} from "./policy";

const uuidV7 = "019f742b-de82-7292-86cd-5475a1388313";

describe("OFF-03 local security policy", () => {
  it.each([
    [false, "missing", "not_enrolled"],
    [true, "available", "ready"],
    [true, "cancelled", "locked"],
    [true, "unavailable", "locked"],
    [true, "missing", "reauthentication_required"],
  ] as const)("classifies marker %s and key %s as %s", (marker, key, expected) => {
    expect(
      resolveLocalSecurityState({
        enrollmentMarkerPresent: marker,
        protectedKeyState: key,
      }),
    ).toBe(expected);
  });

  it("accepts only the fixed biometric policy, UUIDv7 identifiers, and schema version", () => {
    expect(
      parseLocalEnrollmentMarker(
        JSON.stringify({
          appLockPolicy: localAppLockPolicy,
          deviceId: uuidV7,
          generationId: uuidV7,
          householdId: uuidV7,
          localSchemaVersion: 3,
        }),
      ),
    ).toMatchObject({ localSchemaVersion: 3 });
    expect(() =>
      parseLocalEnrollmentMarker(
        JSON.stringify({
          appLockPolicy: "none",
          deviceId: uuidV7,
          generationId: uuidV7,
          householdId: uuidV7,
          localSchemaVersion: 1,
        }),
      ),
    ).toThrow("invalid");
    expect(
      parseLocalEnrollmentMarker(
        JSON.stringify({
          appLockPolicy: localAppLockPolicy,
          deviceId: uuidV7,
          generationId: uuidV7,
          householdId: uuidV7,
          localSchemaVersion: 1,
        }),
      ),
    ).toMatchObject({ localSchemaVersion: 1 });
  });

  it("wipes local security even when remote sign-out fails", async () => {
    const order: string[] = [];
    await expect(
      runSignOutWithLocalWipe({
        async remoteSignOut() {
          order.push("remote");
          throw new Error("offline");
        },
        async wipeLocalSecurity() {
          order.push("wipe");
        },
      }),
    ).rejects.toThrow("offline");
    expect(order).toEqual(["remote", "wipe"]);
  });
});
