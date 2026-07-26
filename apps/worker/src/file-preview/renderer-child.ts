import { stat } from "node:fs/promises";
import { filePreviewPolicy, fileValidationLimits } from "@littlearc/domain";
import sharp from "sharp";

type Result =
  | {
      readonly bytes: number;
      readonly height: number;
      readonly status: "rendered";
      readonly width: number;
    }
  | {
      readonly capability: {
        readonly heif: string;
        readonly jpeg: boolean;
        readonly png: boolean;
        readonly sharp: string;
        readonly vips: string;
      };
      readonly status: "capable";
    }
  | {
      readonly code: "output_invalid" | "render_failed" | "resource_limit_exceeded";
      readonly status: "rejected";
    };

async function main(): Promise<Result> {
  if (process.argv[2] === "--probe" && process.argv.length === 3) {
    return {
      capability: {
        heif: sharp.format.heif.input.file ? "system" : "unavailable",
        jpeg: Boolean(sharp.format.jpeg.input.file && sharp.format.jpeg.output.file),
        png: Boolean(sharp.format.png.input.file && sharp.format.png.output.file),
        sharp: sharp.versions.sharp,
        vips: sharp.versions.vips,
      },
      status: "capable",
    };
  }
  if (process.argv[2] !== "--render" || process.argv.length !== 7) {
    return { code: "render_failed", status: "rejected" };
  }
  const [, , , inputPath, outputPath, dimensionText, qualityText] = process.argv;
  const maxDimension = Number(dimensionText);
  const quality = Number(qualityText);
  if (
    !inputPath ||
    !outputPath ||
    !filePreviewPolicy.renderAttempts.some(
      (attempt) => attempt.maxDimension === maxDimension && attempt.quality === quality,
    )
  ) {
    return { code: "render_failed", status: "rejected" };
  }
  try {
    const source = sharp(inputPath, {
      failOn: "warning",
      limitInputPixels: fileValidationLimits.maxImagePixels,
      pages: 1,
      sequentialRead: true,
    });
    const sourceMetadata = await source.metadata();
    if (
      (sourceMetadata.pages ?? 1) !== 1 ||
      !sourceMetadata.width ||
      !sourceMetadata.height ||
      sourceMetadata.width > fileValidationLimits.maxImageDimension ||
      sourceMetadata.height > fileValidationLimits.maxImageDimension ||
      sourceMetadata.width * sourceMetadata.height > fileValidationLimits.maxImagePixels
    ) {
      return { code: "resource_limit_exceeded", status: "rejected" };
    }
    await source
      .autoOrient()
      .resize({
        fit: "inside",
        height: maxDimension,
        kernel: "lanczos3",
        width: maxDimension,
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .toColorspace("srgb")
      .jpeg({
        chromaSubsampling: "4:2:0",
        force: true,
        mozjpeg: false,
        optimizeCoding: false,
        progressive: false,
        quality,
      })
      .toFile(outputPath);
    const outputMetadata = await sharp(outputPath, {
      failOn: "warning",
      limitInputPixels: fileValidationLimits.maxImagePixels,
    }).metadata();
    const bytes = (await stat(outputPath)).size;
    if (
      outputMetadata.format !== "jpeg" ||
      outputMetadata.isProgressive === true ||
      !outputMetadata.width ||
      !outputMetadata.height ||
      outputMetadata.width > maxDimension ||
      outputMetadata.height > maxDimension ||
      outputMetadata.exif ||
      outputMetadata.icc ||
      outputMetadata.iptc ||
      outputMetadata.xmp
    ) {
      return { code: "output_invalid", status: "rejected" };
    }
    return {
      bytes,
      height: outputMetadata.height,
      status: "rendered",
      width: outputMetadata.width,
    };
  } catch {
    return { code: "render_failed", status: "rejected" };
  }
}

const result = await main();
process.stdout.write(JSON.stringify(result));
if (result.status === "rejected") {
  process.exitCode = 2;
}
