import { fileValidationLimits } from "@littlearc/domain";
import sharp from "sharp";

type SafeCode = "malformed_structure" | "resource_limit_exceeded" | "unsupported_format";

sharp.cache(false);
sharp.concurrency(1);

const mode = process.argv[2];
if (mode === "--probe") {
  if (
    !sharp.format.heif.input.file ||
    !sharp.format.heif.input.buffer ||
    !sharp.format.heif.input.fileSuffix?.includes(".heic")
  ) {
    emit({ code: "unsupported_format", status: "rejected" });
  } else {
    emit({
      capability: {
        heif: sharp.versions.heif ?? "system",
        sharp: sharp.versions.sharp ?? "unavailable",
        vips: sharp.versions.vips ?? "unavailable",
      },
      status: "capable",
    });
  }
} else if (mode === "--decode" && process.argv.length === 4) {
  emit(await decode(process.argv[3] ?? ""));
} else {
  emit({ code: "malformed_structure", status: "rejected" });
}

async function decode(
  path: string,
): Promise<
  { readonly code: SafeCode; readonly status: "rejected" } | { readonly status: "valid" }
> {
  let pixels: Buffer | undefined;
  try {
    const options = {
      failOn: "warning" as const,
      limitInputPixels: fileValidationLimits.maxImagePixels,
      pages: 1,
      sequentialRead: true,
      unlimited: false,
    };
    const metadata = await sharp(path, options).metadata();
    if (
      metadata.format !== "heif" ||
      metadata.compression !== "hevc" ||
      (metadata.pages ?? 1) !== 1 ||
      (metadata.pagePrimary ?? 0) !== 0 ||
      !["uchar", "ushort"].includes(metadata.depth) ||
      metadata.channels < 1 ||
      metadata.channels > 4
    ) {
      throw new SafeDecoderError("unsupported_format");
    }
    assertBounds(metadata.width, metadata.height);
    const decoded = await sharp(path, options).raw({ depth: "uchar" }).toBuffer({
      resolveWithObject: true,
    });
    pixels = decoded.data;
    assertBounds(decoded.info.width, decoded.info.height);
    if (
      decoded.info.width !== metadata.width ||
      decoded.info.height !== metadata.height ||
      decoded.info.channels < 1 ||
      decoded.info.channels > 4 ||
      pixels.length !== decoded.info.width * decoded.info.height * decoded.info.channels
    ) {
      throw new SafeDecoderError("malformed_structure");
    }
    return { status: "valid" };
  } catch (error) {
    if (error instanceof SafeDecoderError) {
      return { code: error.code, status: "rejected" };
    }
    return { code: "malformed_structure", status: "rejected" };
  } finally {
    pixels?.fill(0);
  }
}

function assertBounds(width: number, height: number): void {
  if (
    width < 1 ||
    height < 1 ||
    width > fileValidationLimits.maxImageDimension ||
    height > fileValidationLimits.maxImageDimension ||
    width * height > fileValidationLimits.maxImagePixels
  ) {
    throw new SafeDecoderError("resource_limit_exceeded");
  }
}

class SafeDecoderError extends Error {
  constructor(readonly code: SafeCode) {
    super("HEIC decode rejected.");
  }
}

function emit(value: object): void {
  process.stdout.write(JSON.stringify(value));
}
