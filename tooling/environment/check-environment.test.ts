import { describe, expect, it } from "vitest";
import { validateEnvironmentEntries } from "./policy.mjs";

describe("environment template policy", () => {
  it("accepts blank secrets and safe public defaults", () => {
    const catalog = {
      APP_ENV: { classification: "public", secret: false },
      AUTH_SECRET: { classification: "secret", secret: true },
    };
    const entries = new Map([
      ["APP_ENV", "local"],
      ["AUTH_SECRET", ""],
    ]);

    expect(validateEnvironmentEntries(".env.example", catalog, entries)).toEqual([]);
  });

  it("rejects a populated secret", () => {
    const catalog = {
      AUTH_SECRET: { classification: "secret", secret: true },
    };
    const entries = new Map([["AUTH_SECRET", "must-not-pass"]]);

    expect(validateEnvironmentEntries(".env.example", catalog, entries).join("\n")).toContain(
      "AUTH_SECRET must remain blank",
    );
  });

  it("rejects an undocumented variable", () => {
    const entries = new Map([["UNREVIEWED_VALUE", "value"]]);

    expect(validateEnvironmentEntries(".env.example", {}, entries).join("\n")).toContain(
      "undocumented variable UNREVIEWED_VALUE",
    );
  });

  it("rejects a non-public Expo client variable", () => {
    const catalog = {
      EXPO_PUBLIC_VALUE: { classification: "sensitive", secret: false },
    };
    const entries = new Map([["EXPO_PUBLIC_VALUE", "value"]]);

    expect(validateEnvironmentEntries(".env.example", catalog, entries).join("\n")).toContain(
      "client-visible and must be classified public",
    );
  });
});
