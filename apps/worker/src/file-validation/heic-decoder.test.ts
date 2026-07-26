import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSharpHeicDecoder, parseChildResult } from "./heic-decoder.js";
import { FileValidationError } from "./structure.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("HEIC decoder protocol", () => {
  it("accepts the minimized valid result", () => {
    expect(parseChildResult('{"status":"valid"}')).toEqual({ status: "valid" });
  });

  it("accepts only safe rejection codes", () => {
    expect(parseChildResult('{"status":"rejected","code":"resource_limit_exceeded"}')).toEqual({
      code: "resource_limit_exceeded",
      status: "rejected",
    });
    expect(() => parseChildResult('{"status":"rejected","code":"decoder detail"}')).toThrow(
      FileValidationError,
    );
  });

  it("accepts a generic capability result without document metadata", () => {
    expect(
      parseChildResult(
        '{"status":"capable","capability":{"sharp":"0.35.3","vips":"8.18.3","heif":"1.15.1"}}',
      ),
    ).toEqual({
      capability: { heif: "1.15.1", sharp: "0.35.3", vips: "8.18.3" },
      status: "capable",
    });
  });

  it("rejects malformed and expanded protocol output", () => {
    expect(() => parseChildResult("not-json")).toThrow(FileValidationError);
    expect(() => parseChildResult('{"status":"valid","filename":"forbidden"}')).toThrow(
      FileValidationError,
    );
    expect(() => parseChildResult('{"status":"capable","capability":{}}')).toThrow(
      FileValidationError,
    );
  });
});

describe("HEIC decoder process boundary", () => {
  it("maps a child crash to a safe malformed result", async () => {
    const childExecutable = await script("process.abort();");
    const decoder = createSharpHeicDecoder({ childExecutable });

    await expect(decoder.decode("opaque-input")).rejects.toMatchObject({
      code: "malformed_structure",
    });
  });

  it("maps a wall-clock timeout to the resource limit code", async () => {
    const childExecutable = await script("setInterval(() => undefined, 1000);");
    const decoder = createSharpHeicDecoder({ childExecutable, timeoutMs: 50 });

    await expect(decoder.decode("opaque-input")).rejects.toMatchObject({
      code: "resource_limit_exceeded",
    });
  });

  it("propagates cancellation instead of terminally rejecting the file", async () => {
    const childExecutable = await script("setInterval(() => undefined, 1000);");
    const decoder = createSharpHeicDecoder({ childExecutable });
    const controller = new AbortController();
    const result = decoder.decode("opaque-input", controller.signal);
    controller.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
});

async function script(source: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "littlearc-heic-process-test-"));
  roots.push(root);
  const path = join(root, "child.mjs");
  await writeFile(path, source, { mode: 0o600 });
  return path;
}
