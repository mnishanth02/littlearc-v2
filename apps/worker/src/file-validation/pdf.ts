import { execFile } from "node:child_process";
import { open } from "node:fs/promises";
import { promisify } from "node:util";
import { fileValidationLimits } from "@littlearc/domain";
import { FileValidationError, type PdfInspector } from "./structure.js";

const execFileAsync = promisify(execFile);

const activeTokens = new Set([
  "/AA",
  "/AcroForm",
  "/GoToR",
  "/ImportData",
  "/JavaScript",
  "/JS",
  "/Launch",
  "/Movie",
  "/OpenAction",
  "/Rendition",
  "/RichMedia",
  "/Sound",
  "/SubmitForm",
  "/URI",
  "/XFA",
  "/3D",
]);

const embeddedTokens = new Set([
  "/Collection",
  "/EF",
  "/EmbeddedFile",
  "/EmbeddedFiles",
  "/FileAttachment",
  "/Filespec",
]);

export function createQpdfInspector(options: {
  readonly executable: string;
  readonly sandboxExecutable?: string;
}): PdfInspector {
  const run = async (arguments_: ReadonlyArray<string>, signal?: AbortSignal): Promise<string> => {
    const executable = options.sandboxExecutable ?? options.executable;
    const args = options.sandboxExecutable
      ? [
          "--no-new-privs",
          "/usr/bin/prlimit",
          "--as=536870912",
          "--cpu=30",
          "--fsize=16777216",
          "--nofile=64",
          "--nproc=8",
          "--",
          options.executable,
          ...arguments_,
        ]
      : [...arguments_];
    try {
      const result = await execFileAsync(executable, args, {
        encoding: "utf8",
        env: { LANG: "C", PATH: "/usr/bin:/bin" },
        maxBuffer: fileValidationLimits.maxPdfJsonBytes,
        signal,
        timeout: fileValidationLimits.parserTimeoutMs,
        windowsHide: true,
      });
      return result.stdout;
    } catch {
      throw new FileValidationError("malformed_structure");
    }
  };

  return {
    async inspect(path, signal) {
      await assertStrictPdfEnd(path);
      await run(["--check", path], signal);
      const output = await run(["--json=2", "--json-stream-data=none", path], signal);
      let parsed: unknown;
      try {
        parsed = JSON.parse(output);
      } catch {
        throw new FileValidationError("malformed_structure");
      }
      return inspectQpdfJson(parsed);
    },
  };
}

export function inspectQpdfJson(value: unknown): { readonly pageCount: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FileValidationError("malformed_structure");
  }
  const root = value as Record<string, unknown>;
  if (hasTruthyEncryption(root)) {
    throw new FileValidationError("pdf_encrypted");
  }
  const pages = root.pages;
  if (!Array.isArray(pages) || pages.length < 1) {
    throw new FileValidationError("malformed_structure");
  }
  if (pages.length > fileValidationLimits.maxPdfPages) {
    throw new FileValidationError("resource_limit_exceeded");
  }

  let objectCount = 0;
  const seen = new Set<object>();
  const stack: Array<{ readonly depth: number; readonly value: unknown }> = [{ depth: 0, value }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      break;
    }
    if (current.depth > fileValidationLimits.maxStructureDepth) {
      throw new FileValidationError("resource_limit_exceeded");
    }
    if (typeof current.value === "string") {
      classifyToken(current.value);
      continue;
    }
    if (!current.value || typeof current.value !== "object" || seen.has(current.value)) {
      continue;
    }
    seen.add(current.value);
    if (Array.isArray(current.value)) {
      for (const item of current.value) {
        stack.push({ depth: current.depth + 1, value: item });
      }
      continue;
    }
    for (const [key, item] of Object.entries(current.value as Record<string, unknown>)) {
      if (/^obj:\d+ \d+ R$/.test(key)) {
        objectCount += 1;
        if (objectCount > fileValidationLimits.maxPdfObjects) {
          throw new FileValidationError("resource_limit_exceeded");
        }
      }
      classifyToken(key);
      stack.push({ depth: current.depth + 1, value: item });
    }
  }
  return { pageCount: pages.length };
}

function classifyToken(token: string): void {
  if (embeddedTokens.has(token)) {
    throw new FileValidationError("pdf_embedded_content");
  }
  if (activeTokens.has(token)) {
    throw new FileValidationError("pdf_active_content");
  }
}

function hasTruthyEncryption(root: Record<string, unknown>): boolean {
  const encryption = root.encrypt ?? root.encrypted;
  return (
    encryption !== undefined && encryption !== null && encryption !== false && encryption !== ""
  );
}

async function assertStrictPdfEnd(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    const size = (await handle.stat()).size;
    const length = Math.min(size, 4096);
    const tail = Buffer.alloc(length);
    const read = await handle.read(tail, 0, length, size - length);
    if (read.bytesRead !== length) {
      throw new FileValidationError("malformed_structure");
    }
    const text = tail.toString("latin1");
    const marker = text.lastIndexOf("%%EOF");
    const allowedTrailingBytes = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
    if (marker < 0 || tail.subarray(marker + 5).some((byte) => !allowedTrailingBytes.has(byte))) {
      throw new FileValidationError("malformed_structure");
    }
  } finally {
    await handle.close();
  }
}
