import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { fileValidationLimits } from "@littlearc/domain";
import type { ParserPermit } from "./parser-permit.js";
import { FileValidationError } from "./structure.js";

const execFileAsync = promisify(execFile);
const defaultChildExecutable = fileURLToPath(new URL("./heic-decoder-child.js", import.meta.url));

export type HeicDecoder = {
  readonly decode: (path: string, signal?: AbortSignal) => Promise<void>;
  readonly probe: (signal?: AbortSignal) => Promise<HeicDecoderCapability>;
};

export type HeicDecoderCapability = {
  readonly heif: string;
  readonly sharp: string;
  readonly vips: string;
};

type ChildResult =
  | { readonly capability: HeicDecoderCapability; readonly status: "capable" }
  | {
      readonly code: "malformed_structure" | "resource_limit_exceeded" | "unsupported_format";
      readonly status: "rejected";
    }
  | { readonly status: "valid" };

export function createSharpHeicDecoder(options: {
  readonly childExecutable?: string;
  readonly nodeExecutable?: string;
  readonly sandboxExecutable?: string;
  readonly timeoutMs?: number;
  readonly parserPermit?: ParserPermit;
}): HeicDecoder {
  const run = async (
    arguments_: ReadonlyArray<string>,
    signal?: AbortSignal,
    sandboxed = true,
  ): Promise<ChildResult> => {
    const nodeExecutable = options.nodeExecutable ?? process.execPath;
    const childExecutable = options.childExecutable ?? defaultChildExecutable;
    const useSandbox = sandboxed && Boolean(options.sandboxExecutable);
    const executable = useSandbox ? (options.sandboxExecutable ?? nodeExecutable) : nodeExecutable;
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
          nodeExecutable,
          "--max-old-space-size=256",
          "--max-semi-space-size=16",
          childExecutable,
          ...arguments_,
        ]
      : [childExecutable, ...arguments_];
    try {
      const execute = () =>
        execFileAsync(executable, args, {
          encoding: "utf8",
          env: {
            LANG: "C",
            MALLOC_ARENA_MAX: "2",
            PATH: "/usr/local/bin:/usr/bin:/bin",
            SHARP_CONCURRENCY: "1",
            OMP_NUM_THREADS: "1",
            VIPS_DISC_THRESHOLD: "0",
          },
          maxBuffer: 4096,
          signal,
          timeout: options.timeoutMs ?? fileValidationLimits.parserTimeoutMs,
          windowsHide: true,
        });
      const result = options.parserPermit
        ? await options.parserPermit.run(execute, signal)
        : await execute();
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
        throw new FileValidationError("resource_limit_exceeded");
      }
      throw new FileValidationError("malformed_structure");
    }
  };

  return {
    async decode(path, signal) {
      signal?.throwIfAborted();
      const result = await run(["--decode", path], signal);
      if (result.status === "valid") {
        return;
      }
      if (result.status === "rejected") {
        throw new FileValidationError(result.code);
      }
      throw new FileValidationError("malformed_structure");
    },
    async probe(signal) {
      const result = await run(["--probe"], signal, false);
      if (result.status !== "capable") {
        throw new FileValidationError("unsupported_format");
      }
      return result.capability;
    },
  };
}

export function parseChildResult(output: string): ChildResult {
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    throw new FileValidationError("malformed_structure");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FileValidationError("malformed_structure");
  }
  const result = value as Record<string, unknown>;
  if (result.status === "valid" && Object.keys(result).length === 1) {
    return { status: "valid" };
  }
  if (
    result.status === "rejected" &&
    Object.keys(result).length === 2 &&
    ["malformed_structure", "resource_limit_exceeded", "unsupported_format"].includes(
      String(result.code),
    )
  ) {
    return {
      code: result.code as "malformed_structure" | "resource_limit_exceeded" | "unsupported_format",
      status: "rejected",
    };
  }
  const capability = result.capability;
  if (
    result.status === "capable" &&
    Object.keys(result).length === 2 &&
    capability &&
    typeof capability === "object" &&
    !Array.isArray(capability)
  ) {
    const versions = capability as Record<string, unknown>;
    if (
      typeof versions.sharp === "string" &&
      typeof versions.vips === "string" &&
      typeof versions.heif === "string"
    ) {
      return {
        capability: {
          heif: versions.heif,
          sharp: versions.sharp,
          vips: versions.vips,
        },
        status: "capable",
      };
    }
  }
  throw new FileValidationError("malformed_structure");
}
