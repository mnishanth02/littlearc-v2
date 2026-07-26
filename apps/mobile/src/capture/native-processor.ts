import { requireNativeModule } from "expo";
import type { CaptureInspection, CaptureSafeErrorCode } from "./policy";

type NativeCaptureResult = CaptureInspection & {
  readonly normalizedUri: string | null;
  readonly originalUri: string;
  readonly thumbnailUri: string;
};

type NativeCaptureProcessor = {
  readonly processAsync: (
    sourceUri: string,
    outputDirectoryUri: string,
    opaqueBaseName: string,
    thumbnailDimension: number,
  ) => Promise<NativeCaptureResult>;
};

let captureProcessor: NativeCaptureProcessor | undefined;

export async function processCaptureSource(input: {
  readonly opaqueBaseName: string;
  readonly outputDirectoryUri: string;
  readonly sourceUri: string;
  readonly thumbnailDimension: number;
}): Promise<NativeCaptureResult> {
  if (!captureProcessor) {
    captureProcessor = requireNativeModule<NativeCaptureProcessor>("LittleArcCaptureProcessor");
  }
  try {
    return await captureProcessor.processAsync(
      input.sourceUri,
      input.outputDirectoryUri,
      input.opaqueBaseName,
      input.thumbnailDimension,
    );
  } catch (error) {
    throw new CaptureProcessingError(captureSafeCode(error), { cause: error });
  }
}

export class CaptureProcessingError extends Error {
  constructor(
    readonly code: CaptureSafeErrorCode,
    options?: ErrorOptions,
  ) {
    super("The capture source could not be processed safely.", options);
    this.name = "CaptureProcessingError";
  }
}

function captureSafeCode(error: unknown): CaptureSafeErrorCode {
  const value =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { readonly code: unknown }).code)
      : "";
  const codes: ReadonlyArray<CaptureSafeErrorCode> = [
    "capture_empty",
    "capture_invalid_metadata",
    "capture_page_limit",
    "capture_processing_failed",
    "capture_size_limit",
    "capture_storage_unavailable",
    "capture_unsupported_type",
  ];
  return codes.includes(value as CaptureSafeErrorCode)
    ? (value as CaptureSafeErrorCode)
    : "capture_processing_failed";
}
