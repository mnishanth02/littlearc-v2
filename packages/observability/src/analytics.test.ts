import { describe, expect, it, vi } from "vitest";
import { createAnalytics, type SafeAnalyticsEvent, sanitizeAnalyticsEvent } from "./analytics.js";
import { sensitiveCanaries } from "./test-canaries.js";

describe("analytics allowlist", () => {
  it("keeps delivery disabled by default", () => {
    const sink = vi.fn();
    const analytics = createAnalytics({ sink });

    expect(
      analytics.capture("application_started", {
        appVersion: "0.0.0",
        environment: "local",
        platform: "ios",
      }),
    ).toBe(false);
    expect(sink).not.toHaveBeenCalled();
  });

  it("emits only allowlisted event properties", () => {
    const events: SafeAnalyticsEvent[] = [];
    const analytics = createAnalytics({
      canaries: sensitiveCanaries,
      enabled: true,
      sink: (event) => events.push(event),
    });

    expect(
      analytics.capture("foundation_health_checked", {
        duration: "under_100ms",
        outcome: "success",
        service: "api",
      }),
    ).toBe(true);
    expect(events).toEqual([
      {
        name: "foundation_health_checked",
        properties: { duration: "under_100ms", outcome: "success", service: "api" },
      },
    ]);
  });

  it("accepts only coarse onboarding milestones without identifiers", () => {
    expect(
      sanitizeAnalyticsEvent("onboarding_milestone_reached", {
        milestone: "emergency_card_synced",
        outcome: "completed",
        platform: "android",
      }),
    ).toEqual({
      name: "onboarding_milestone_reached",
      properties: {
        milestone: "emergency_card_synced",
        outcome: "completed",
        platform: "android",
      },
    });

    expect(() =>
      sanitizeAnalyticsEvent("onboarding_milestone_reached", {
        childId: "01900000-0000-7000-8000-000000000001",
        milestone: "child_created",
        outcome: "completed",
        platform: "android",
      }),
    ).toThrow("do not match");
    expect(() =>
      sanitizeAnalyticsEvent("onboarding_milestone_reached", {
        milestone: "child_01900000-0000-7000-8000-000000000001",
        outcome: "completed",
        platform: "android",
      }),
    ).toThrow("bounded value set");
  });

  it("rejects unknown events, extra fields, free text, and canary values", () => {
    expect(() => sanitizeAnalyticsEvent("record_opened", {})).toThrow("not allowlisted");
    expect(() =>
      sanitizeAnalyticsEvent("application_started", {
        appVersion: "0.0.0",
        childName: sensitiveCanaries[0].value,
        environment: "local",
        platform: "ios",
      }),
    ).toThrow("do not match");
    expect(() =>
      sanitizeAnalyticsEvent("foundation_health_checked", {
        duration: "101.25 milliseconds",
        outcome: "success",
        service: "api",
      }),
    ).toThrow("bounded value set");

    const sink = vi.fn();
    const analytics = createAnalytics({
      canaries: sensitiveCanaries,
      enabled: true,
      sink,
    });
    expect(() =>
      analytics.capture("application_started", {
        appVersion: sensitiveCanaries[6].value,
        environment: "local",
        platform: "ios",
      }),
    ).toThrow();
    expect(sink).not.toHaveBeenCalled();
  });
});
