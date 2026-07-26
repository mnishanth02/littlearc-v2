import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateFileStructure } from "./structure.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("layered file structure validation", () => {
  it("accepts bounded complete JPEG and PNG structures", async () => {
    const jpegPath = await fixture("synthetic.jpg", jpegFixture());
    const pngPath = await fixture(
      "synthetic.png",
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const pdfInspector = { inspect: vi.fn() };

    await expect(
      validateFileStructure({
        declaredMime: "image/jpeg",
        path: jpegPath,
        pdfInspector,
      }),
    ).resolves.toEqual({ detectedMime: "image/jpeg", pageCount: null });
    await expect(
      validateFileStructure({
        declaredMime: "image/png",
        path: pngPath,
        pdfInspector,
      }),
    ).resolves.toEqual({ detectedMime: "image/png", pageCount: null });
  });

  it("rejects MIME mismatch, truncation, trailing bytes, and cancellation", async () => {
    const jpeg = jpegFixture();
    const mismatchPath = await fixture("mismatch.bin", jpeg);
    const truncatedPath = await fixture("truncated.bin", jpeg.subarray(0, jpeg.length - 2));
    const trailingPath = await fixture(
      "trailing.bin",
      Buffer.concat([jpeg, Buffer.from("trailing")]),
    );
    const pdfInspector = { inspect: vi.fn() };

    await expect(
      validateFileStructure({
        declaredMime: "application/pdf",
        path: mismatchPath,
        pdfInspector,
      }),
    ).rejects.toMatchObject({ code: "type_mismatch" });
    await expect(
      validateFileStructure({
        declaredMime: "image/jpeg",
        path: truncatedPath,
        pdfInspector,
      }),
    ).rejects.toMatchObject({ code: "malformed_structure" });
    await expect(
      validateFileStructure({
        declaredMime: "image/jpeg",
        path: trailingPath,
        pdfInspector,
      }),
    ).rejects.toMatchObject({ code: "malformed_structure" });

    const controller = new AbortController();
    controller.abort();
    await expect(
      validateFileStructure({
        declaredMime: "image/jpeg",
        path: mismatchPath,
        pdfInspector,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("fails closed for a structurally bounded HEIC container without an authorized decoder", async () => {
    const path = await fixture(
      "synthetic.heic",
      Buffer.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00,
        0x00, 0x6d, 0x69, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x08, 0x6d, 0x64,
        0x61, 0x74,
      ]),
    );

    await expect(
      validateFileStructure({
        declaredMime: "image/heic",
        path,
        pdfInspector: { inspect: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: "unsupported_format" });
  });
});

async function fixture(name: string, bytes: Buffer): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "littlearc-structure-test-"));
  roots.push(root);
  const path = join(root, name);
  await writeFile(path, bytes, { mode: 0o600 });
  return path;
}

function jpegFixture(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0x01, 0x11,
    0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11,
    0x03, 0x11, 0x00, 0x3f, 0x00, 0x00, 0xff, 0xd9,
  ]);
}
