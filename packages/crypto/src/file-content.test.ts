import { randomBytes } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { decryptFileContent, encryptFileContent } from "./file-content.js";

async function collect(stream: PassThrough): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe("streaming file content crypto", () => {
  it("round trips authenticated content", async () => {
    const key = randomBytes(32);
    const encrypted = new PassThrough();
    const encryptedBytes = collect(encrypted);
    const result = await encryptFileContent({
      aad: "synthetic-aad",
      ciphertext: encrypted,
      fileKey: key,
      plaintext: Readable.from(Buffer.from("synthetic content")),
    });
    const plaintext = new PassThrough();
    const plaintextBytes = collect(plaintext);
    await decryptFileContent({
      aad: "synthetic-aad",
      authTag: result.authTag,
      ciphertext: Readable.from(await encryptedBytes),
      fileKey: key,
      nonce: result.nonce,
      plaintext,
    });
    expect((await plaintextBytes).toString("utf8")).toBe("synthetic content");
  });

  it("rejects tampering before reporting success", async () => {
    const key = randomBytes(32);
    const encrypted = new PassThrough();
    const encryptedBytes = collect(encrypted);
    const result = await encryptFileContent({
      aad: "synthetic-aad",
      ciphertext: encrypted,
      fileKey: key,
      plaintext: Readable.from(Buffer.from("synthetic content")),
    });
    const tampered = await encryptedBytes;
    tampered[0] = (tampered[0] ?? 0) ^ 1;
    await expect(
      decryptFileContent({
        aad: "synthetic-aad",
        authTag: result.authTag,
        ciphertext: Readable.from(tampered),
        fileKey: key,
        nonce: result.nonce,
        plaintext: new PassThrough(),
      }),
    ).rejects.toThrow();
  });
});
