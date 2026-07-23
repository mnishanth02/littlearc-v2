import { describe, expect, it } from "vitest";
import {
  formatReverseRules,
  getProfileDifferences,
  getProfileExpectations,
  isSecurityPatchStale,
  parseAdbDevices,
  parseBattery,
  selectSinglePhysicalDevice,
} from "./policy.mjs";

describe("Android physical-device policy", () => {
  it("selects one authorized physical device without exposing emulator entries", () => {
    const devices = parseAdbDevices(`List of devices attached
emulator-5554 device product:sdk_gphone model:sdk_gphone transport_id:1
physical-id device usb:20-3 product:OnePlus8T_IND model:KB2001 transport_id:2
`);

    expect(selectSinglePhysicalDevice(devices)).toMatchObject({
      serial: "physical-id",
      state: "device",
      attributes: {
        model: "KB2001",
      },
    });
  });

  it("fails when a physical device has not accepted USB debugging", () => {
    const devices = parseAdbDevices(`List of devices attached
physical-id unauthorized usb:20-3
`);

    expect(() => selectSinglePhysicalDevice(devices)).toThrow(/not authorized/);
  });

  it("fails when more than one physical device is connected", () => {
    const devices = parseAdbDevices(`List of devices attached
first device usb:20-3
second device usb:20-4
`);

    expect(() => selectSinglePhysicalDevice(devices)).toThrow(/exactly one/);
  });

  it("parses the Android battery service fields", () => {
    expect(
      parseBattery(`Current Battery Service state:
  status: 2
  health: 2
  level: 30
  temperature: 349
`),
    ).toEqual({
      level: 30,
      temperatureTenthsCelsius: 349,
      health: 2,
      status: 2,
    });
  });

  it("flags stale or invalid Android security patch dates", () => {
    const now = new Date("2026-07-23T00:00:00Z");

    expect(isSecurityPatchStale("2024-10-05", now)).toBe(true);
    expect(isSecurityPatchStale("2026-06-05", now)).toBe(false);
    expect(isSecurityPatchStale("unknown", now)).toBe(true);
  });

  it("keeps daily and acceptance profiles explicit and reversible", () => {
    expect(getProfileExpectations("daily")).toMatchObject({
      stayAwake: "2",
      peakRefreshRate: 60,
    });
    expect(getProfileExpectations("acceptance")).toMatchObject({
      stayAwake: "0",
      peakRefreshRate: 120,
    });
    expect(() => getProfileExpectations("stress")).toThrow(/Unknown device profile/);
  });

  it("reports only profile values that need a manual OxygenOS change", () => {
    expect(
      getProfileDifferences("acceptance", {
        stayAwake: "0",
        windowAnimation: "1.0",
        transitionAnimation: "1.0",
        animatorDuration: "1.0",
        peakRefreshRate: "120.00001",
      }),
    ).toEqual([]);
    expect(
      getProfileDifferences("daily", {
        stayAwake: "0",
        windowAnimation: "1.0",
        transitionAnimation: "1.0",
        animatorDuration: "1.0",
        peakRefreshRate: "120.00001",
      }),
    ).toHaveLength(5);
  });

  it("removes device identifiers from reverse-port status", () => {
    expect(
      formatReverseRules(`device-serial tcp:8081 tcp:8081
device-serial tcp:3000 tcp:3000
`),
    ).toBe(`tcp:8081 -> tcp:8081
tcp:3000 -> tcp:3000`);
  });
});
