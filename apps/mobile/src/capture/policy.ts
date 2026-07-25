export const maximumCaptureBytes = 25 * 1024 * 1024;
export const maximumCapturePages = 50;
export const maximumThumbnailDimension = 512;

export const captureSourceKinds = ["scanner", "camera", "gallery", "file", "share"] as const;
export type CaptureSourceKind = (typeof captureSourceKinds)[number];

export const captureMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/pdf",
] as const;
export type CaptureMimeType = (typeof captureMimeTypes)[number];

export type CaptureSafeErrorCode =
  | "capture_empty"
  | "capture_invalid_metadata"
  | "capture_page_limit"
  | "capture_permission_denied"
  | "capture_processing_failed"
  | "capture_size_limit"
  | "capture_storage_unavailable"
  | "capture_unsupported_type";

export type CaptureInspection = {
  readonly byteCount: number;
  readonly height: number | null;
  readonly mimeType: CaptureMimeType;
  readonly pageCount: number;
  readonly width: number | null;
};

export type CaptureValidation =
  | { readonly accepted: true; readonly inspection: CaptureInspection }
  | { readonly accepted: false; readonly code: CaptureSafeErrorCode };

export function validateCaptureInspection(
  inspection: CaptureInspection,
  existingPageCount = 0,
): CaptureValidation {
  if (
    !Number.isSafeInteger(inspection.byteCount) ||
    !Number.isSafeInteger(inspection.pageCount) ||
    !Number.isSafeInteger(existingPageCount) ||
    inspection.byteCount <= 0 ||
    inspection.pageCount <= 0 ||
    existingPageCount < 0
  ) {
    return { accepted: false, code: "capture_invalid_metadata" };
  }
  if (!captureMimeTypes.includes(inspection.mimeType)) {
    return { accepted: false, code: "capture_unsupported_type" };
  }
  if (inspection.byteCount > maximumCaptureBytes) {
    return { accepted: false, code: "capture_size_limit" };
  }
  if (
    inspection.pageCount > maximumCapturePages ||
    existingPageCount + inspection.pageCount > maximumCapturePages
  ) {
    return { accepted: false, code: "capture_page_limit" };
  }
  if (inspection.mimeType === "application/pdf") {
    if (inspection.width !== null || inspection.height !== null) {
      return { accepted: false, code: "capture_invalid_metadata" };
    }
  } else if (
    inspection.pageCount !== 1 ||
    !Number.isSafeInteger(inspection.width) ||
    !Number.isSafeInteger(inspection.height) ||
    (inspection.width ?? 0) <= 0 ||
    (inspection.height ?? 0) <= 0
  ) {
    return { accepted: false, code: "capture_invalid_metadata" };
  }
  return { accepted: true, inspection };
}

export function captureErrorMessage(code: CaptureSafeErrorCode): string {
  switch (code) {
    case "capture_empty":
      return "This source is empty. Choose another image or PDF.";
    case "capture_invalid_metadata":
      return "LittleArc could not verify this source safely. Choose another file.";
    case "capture_page_limit":
      return `A capture draft can contain at most ${maximumCapturePages} pages.`;
    case "capture_permission_denied":
      return "Permission was not granted. You can choose another source or try again.";
    case "capture_processing_failed":
      return "LittleArc could not prepare this source. Your existing draft is unchanged.";
    case "capture_size_limit":
      return "Each source must be 25 MB or smaller.";
    case "capture_storage_unavailable":
      return "There is not enough protected device storage to add this source.";
    case "capture_unsupported_type":
      return "Choose a JPEG, PNG, HEIC/HEIF, or PDF file.";
  }
}

export function isCaptureSourceKind(value: unknown): value is CaptureSourceKind {
  return (
    typeof value === "string" &&
    captureSourceKinds.includes(value as (typeof captureSourceKinds)[number])
  );
}
