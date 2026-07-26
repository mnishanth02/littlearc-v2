import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertEncryptedEnvelopeV1, createStructuredPayloadCrypto } from "./index.js";

const context = {
  aadSchemaVersion: 1,
  householdId: "019f742b-de82-7292-86cd-5475a1388313",
  objectId: "019f742b-de82-7292-86cd-5475a1388314",
  objectType: "child_profile" as const,
};

describe("encrypted envelope V1", () => {
  it("wraps household keys and round-trips structured payloads", () => {
    const crypto = createStructuredPayloadCrypto({
      keyEncryptionKey: randomBytes(32),
      wrappingKeyVersion: 1,
    });
    const household = crypto.createHouseholdKey();
    const restored = crypto.unwrapHouseholdKey(household.wrapped);
    const envelope = crypto.encrypt(
      { preferredName: "Synthetic Child" },
      context,
      restored,
      household.wrapped.keyVersion,
    );

    expect(() => assertEncryptedEnvelopeV1(envelope)).not.toThrow();
    expect(crypto.decrypt(envelope, context, restored)).toEqual({
      preferredName: "Synthetic Child",
    });
    expect(JSON.stringify(envelope)).not.toContain("Synthetic Child");
    household.plaintextKey.fill(0);
    restored.fill(0);
  });

  it("rejects ciphertext moved to a different household or object", () => {
    const crypto = createStructuredPayloadCrypto({
      keyEncryptionKey: randomBytes(32),
      wrappingKeyVersion: 1,
    });
    const household = crypto.createHouseholdKey();
    const envelope = crypto.encrypt({ value: "synthetic" }, context, household.plaintextKey, 1);

    expect(() =>
      crypto.decrypt(
        envelope,
        { ...context, objectId: "019f742b-de82-7292-86cd-5475a1388315" },
        household.plaintextKey,
      ),
    ).toThrow();
    expect(() =>
      crypto.decrypt(
        { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -1)}A` },
        context,
        household.plaintextKey,
      ),
    ).toThrow();
  });

  it("rejects unknown, incomplete, and malformed envelope shapes", () => {
    expect(() => assertEncryptedEnvelopeV1({ formatVersion: 1 })).toThrow();
    expect(() =>
      assertEncryptedEnvelopeV1({
        aadSchemaVersion: 1,
        algorithm: "AES-256-GCM",
        authTag: "bad",
        ciphertext: "bad",
        contentNonce: "bad",
        extra: "field",
        formatVersion: 1,
        keyVersion: 1,
        wrapNonce: "bad",
        wrappedDek: "bad",
      }),
    ).toThrow();
  });
});
