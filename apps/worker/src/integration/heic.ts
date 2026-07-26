import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createSharpHeicDecoder } from "../file-validation/heic-decoder.js";
import { validateFileStructure } from "../file-validation/structure.js";

const execFileAsync = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "littlearc-heic-integration-"));
const sourcePath = join(root, "source.png");
const vipsPath = join(root, "vips.heic");
const libheifPath = join(root, "libheif.heic");
const sequencePath = join(root, "sequence.heic");
const avifPath = join(root, "synthetic.avif");

try {
  await writeFile(
    sourcePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
    { mode: 0o600 },
  );
  await execFileAsync("vips", ["copy", sourcePath, `${vipsPath}[compression=hevc,lossless=true]`], {
    timeout: 30_000,
  });
  await execFileAsync("heif-enc", ["-L", "-o", libheifPath, sourcePath], {
    timeout: 30_000,
  });
  await execFileAsync("heif-enc", ["-L", "-o", sequencePath, sourcePath, sourcePath], {
    timeout: 30_000,
  });
  await execFileAsync("vips", ["copy", sourcePath, `${avifPath}[compression=av1,lossless=true]`], {
    timeout: 30_000,
  });

  const decoder = createSharpHeicDecoder({});
  const capability = await decoder.probe();
  for (const path of [vipsPath, libheifPath]) {
    await validateFileStructure({
      declaredMime: "image/heic",
      heicDecoder: decoder,
      path,
      pdfInspector: {
        async inspect() {
          throw new Error("PDF inspection is outside this integration check.");
        },
      },
    });
  }

  const valid = await readFile(vipsPath);
  const truncatedPath = join(root, "truncated.heic");
  await writeFile(truncatedPath, valid.subarray(0, valid.length - 16), { mode: 0o600 });
  await expectSafeRejection(decoder.decode(truncatedPath));
  await expectSafeRejection(decoder.decode(sequencePath));
  await expectSafeRejection(
    validateFileStructure({
      declaredMime: "image/heic",
      heicDecoder: decoder,
      path: avifPath,
      pdfInspector: {
        async inspect() {
          throw new Error("PDF inspection is outside this integration check.");
        },
      },
    }),
  );
  const trailingBoxPath = join(root, "trailing-box.heic");
  await writeFile(
    trailingBoxPath,
    Buffer.concat([valid, Buffer.from([0, 0, 0, 8, 0x66, 0x72, 0x65, 0x65])]),
    { mode: 0o600 },
  );
  await expectSafeRejection(
    validateFileStructure({
      declaredMime: "image/heic",
      heicDecoder: decoder,
      path: trailingBoxPath,
      pdfInspector: {
        async inspect() {
          throw new Error("PDF inspection is outside this integration check.");
        },
      },
    }),
  );

  const controller = new AbortController();
  controller.abort();
  await expectCancellation(decoder.decode(vipsPath, controller.signal));

  console.log(
    `VLT-05-F2 local HEIC integration passed: two synthetic encoders, full decode, sequence/AVIF/malformed/trailing rejection, cancellation, and cleanup; sharp=${capability.sharp}; vips=${capability.vips}; libheif=${capability.heif}.`,
  );
} finally {
  await rm(root, { force: true, recursive: true });
}

async function expectSafeRejection(result: Promise<unknown>): Promise<void> {
  try {
    await result;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["malformed_structure", "resource_limit_exceeded", "unsupported_format"].includes(
        String(error.code),
      )
    ) {
      return;
    }
  }
  throw new Error("Expected a privacy-safe HEIC rejection.");
}

async function expectCancellation(result: Promise<void>): Promise<void> {
  try {
    await result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }
  }
  throw new Error("Expected HEIC decode cancellation.");
}
