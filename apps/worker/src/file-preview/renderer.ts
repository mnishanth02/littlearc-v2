import { execFile } from "node:child_process";
import { rename, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { filePreviewPolicy, fileValidationLimits } from "@littlearc/domain";
import type { ParserPermit } from "../file-validation/parser-permit.js";
import { validateJpegStructure } from "../file-validation/structure.js";

const execFileAsync = promisify(execFile);
const defaultChildExecutable = fileURLToPath(new URL("./renderer-child.js", import.meta.url));

export type PreviewRendererErrorCode =
  | "output_invalid"
  | "output_too_large"
  | "render_failed"
  | "renderer_unavailable"
  | "resource_limit_exceeded";

export class PreviewRendererError extends Error {
  readonly code: PreviewRendererErrorCode;

  constructor(code: PreviewRendererErrorCode) {
    super("Preview rendering failed.");
    this.name = "PreviewRendererError";
    this.code = code;
  }
}

export type PreviewRendererCapability = {
  readonly heif: string;
  readonly jpeg: boolean;
  readonly png: boolean;
  readonly poppler: string;
  readonly sharp: string;
  readonly vips: string;
};

export type PreviewRenderer = {
  readonly probe: (signal?: AbortSignal) => Promise<PreviewRendererCapability>;
  readonly render: (input: {
    readonly inputPath: string;
    readonly intermediatePath: string;
    readonly outputPath: string;
    readonly signal?: AbortSignal;
    readonly sourceMime: "application/pdf" | "image/heic" | "image/jpeg" | "image/png";
  }) => Promise<{ readonly bytes: number; readonly height: number; readonly width: number }>;
};

type ChildResult =
  | {
      readonly bytes: number;
      readonly height: number;
      readonly status: "rendered";
      readonly width: number;
    }
  | {
      readonly capability: Omit<PreviewRendererCapability, "poppler">;
      readonly status: "capable";
    }
  | {
      readonly code: Exclude<PreviewRendererErrorCode, "output_too_large" | "renderer_unavailable">;
      readonly status: "rejected";
    };

export function createPreviewRenderer(options: {
  readonly childExecutable?: string;
  readonly nodeExecutable?: string;
  readonly parserPermit?: ParserPermit;
  readonly pdftoppmExecutable: string;
  readonly sandboxExecutable?: string;
  readonly timeoutMs?: number;
}): PreviewRenderer {
  const run = async (
    executable: string,
    arguments_: ReadonlyArray<string>,
    signal?: AbortSignal,
    sandboxed = true,
  ) => {
    const useSandbox = sandboxed && Boolean(options.sandboxExecutable);
    const command = useSandbox ? (options.sandboxExecutable ?? executable) : executable;
    const args = useSandbox
      ? [
          "--no-new-privs",
          "/usr/bin/prlimit",
          "--as=4294967296",
          "--cpu=30",
          "--fsize=16777216",
          "--nofile=64",
          "--nproc=64",
          "--",
          executable,
          ...arguments_,
        ]
      : [...arguments_];
    const execute = () =>
      execFileAsync(command, args, {
        encoding: "utf8",
        env: {
          LANG: "C",
          MALLOC_ARENA_MAX: "2",
          OMP_NUM_THREADS: "1",
          PATH: "/usr/local/bin:/usr/bin:/bin",
          SHARP_CONCURRENCY: "1",
          VIPS_DISC_THRESHOLD: "0",
        },
        maxBuffer: 4096,
        signal,
        timeout: options.timeoutMs ?? fileValidationLimits.parserTimeoutMs,
        windowsHide: true,
      });
    return options.parserPermit ? options.parserPermit.run(execute, signal) : execute();
  };

  const runChild = async (
    arguments_: ReadonlyArray<string>,
    signal?: AbortSignal,
    sandboxed = true,
  ): Promise<ChildResult> => {
    try {
      const result = await run(
        options.nodeExecutable ?? process.execPath,
        [options.childExecutable ?? defaultChildExecutable, ...arguments_],
        signal,
        sandboxed,
      );
      return parseChildResult(result.stdout);
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      if (
        error &&
        typeof error === "object" &&
        (("killed" in error && error.killed === true) ||
          ("code" in error && error.code === "ETIMEDOUT"))
      ) {
        throw new PreviewRendererError("resource_limit_exceeded");
      }
      throw new PreviewRendererError("render_failed");
    }
  };

  return {
    async probe(signal) {
      const [child, poppler] = await Promise.all([
        runChild(["--probe"], signal, false),
        run(options.pdftoppmExecutable, ["-v"], signal, false),
      ]);
      if (child.status !== "capable") {
        throw new PreviewRendererError("renderer_unavailable");
      }
      const version = `${poppler.stdout}${poppler.stderr}`.match(/pdftoppm version ([^\s]+)/)?.[1];
      if (!version) {
        throw new PreviewRendererError("renderer_unavailable");
      }
      return { ...child.capability, poppler: version };
    },
    async render(input) {
      let normalizedInputPath = input.inputPath;
      if (input.sourceMime === "application/pdf") {
        const outputRoot = `${input.intermediatePath}.page`;
        try {
          await run(
            options.pdftoppmExecutable,
            [
              "-f",
              "1",
              "-l",
              "1",
              "-singlefile",
              "-scale-to",
              "1600",
              "-cropbox",
              "-hide-annotations",
              "-jpeg",
              input.inputPath,
              outputRoot,
            ],
            input.signal,
          );
          await rename(`${outputRoot}.jpg`, input.intermediatePath);
          normalizedInputPath = input.intermediatePath;
        } catch (error) {
          if (input.signal?.aborted) {
            throw error;
          }
          throw new PreviewRendererError("render_failed");
        } finally {
          await rm(`${outputRoot}.jpg`, { force: true });
        }
      }
      for (const attempt of filePreviewPolicy.renderAttempts) {
        await rm(input.outputPath, { force: true });
        const result = await runChild(
          [
            "--render",
            normalizedInputPath,
            input.outputPath,
            String(attempt.maxDimension),
            String(attempt.quality),
          ],
          input.signal,
        );
        if (result.status === "rejected") {
          throw new PreviewRendererError(result.code);
        }
        if (result.status !== "rendered") {
          throw new PreviewRendererError("output_invalid");
        }
        const bytes = (await stat(input.outputPath)).size;
        if (bytes <= filePreviewPolicy.maxPlaintextBytes) {
          await validateJpegStructure(input.outputPath, input.signal, true);
          return { bytes, height: result.height, width: result.width };
        }
      }
      throw new PreviewRendererError("output_too_large");
    },
  };
}

export function parseChildResult(output: string): ChildResult {
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    throw new PreviewRendererError("output_invalid");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PreviewRendererError("output_invalid");
  }
  const result = value as Record<string, unknown>;
  if (
    result.status === "rendered" &&
    Object.keys(result).length === 4 &&
    Number.isInteger(result.bytes) &&
    Number.isInteger(result.height) &&
    Number.isInteger(result.width)
  ) {
    return result as ChildResult;
  }
  if (
    result.status === "rejected" &&
    Object.keys(result).length === 2 &&
    ["output_invalid", "render_failed", "resource_limit_exceeded"].includes(String(result.code))
  ) {
    return result as ChildResult;
  }
  const capability = result.capability;
  if (
    result.status === "capable" &&
    Object.keys(result).length === 2 &&
    capability &&
    typeof capability === "object" &&
    !Array.isArray(capability)
  ) {
    const observed = capability as Record<string, unknown>;
    if (
      typeof observed.heif === "string" &&
      typeof observed.jpeg === "boolean" &&
      typeof observed.png === "boolean" &&
      typeof observed.sharp === "string" &&
      typeof observed.vips === "string"
    ) {
      return result as ChildResult;
    }
  }
  throw new PreviewRendererError("output_invalid");
}
