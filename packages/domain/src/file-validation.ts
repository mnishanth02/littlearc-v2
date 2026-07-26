export const fileValidationStates = [
  "pending",
  "queued",
  "validating",
  "result_pending_cleanup",
  "ready",
  "rejected",
  "failed",
] as const;

export type FileValidationState = (typeof fileValidationStates)[number];

export const fileMalwareStates = ["pending", "clean", "detected", "unavailable", "error"] as const;

export type FileMalwareState = (typeof fileMalwareStates)[number];

export const filePreviewStates = [
  "not_authorized",
  "pending",
  "processing",
  "ready",
  "failed",
] as const;

export type FilePreviewState = (typeof filePreviewStates)[number];

export const fileDerivativeStates = [
  "pending",
  "queued",
  "rendering",
  "result_pending_cleanup",
  "ready",
  "failed",
] as const;

export type FileDerivativeState = (typeof fileDerivativeStates)[number];

export const filePreviewSafeErrorCodes = [
  "renderer_unavailable",
  "render_failed",
  "resource_limit_exceeded",
  "output_too_large",
  "output_invalid",
  "scanner_unavailable",
  "encryption_failed",
  "storage_integrity_mismatch",
  "plaintext_cleanup_retry",
  "preview_retry_exhausted",
] as const;

export type FilePreviewSafeErrorCode = (typeof filePreviewSafeErrorCodes)[number];

export const filePreviewPolicy = {
  aadVersion: 1,
  declaredMime: "image/jpeg",
  kind: "validation_preview",
  maxCiphertextBytes: 1024 * 1024,
  maxDimension: 1600,
  maxPlaintextBytes: 1024 * 1024,
  policyVersion: 1,
  renderAttempts: [
    { maxDimension: 1600, quality: 82 },
    { maxDimension: 1280, quality: 76 },
    { maxDimension: 960, quality: 70 },
  ],
} as const;

export const fileValidationSafeErrorCodes = [
  "type_mismatch",
  "unsupported_format",
  "malformed_structure",
  "resource_limit_exceeded",
  "ciphertext_integrity_mismatch",
  "authenticated_decryption_failed",
  "pdf_encrypted",
  "pdf_active_content",
  "pdf_embedded_content",
  "malware_detected",
  "scanner_unavailable",
  "scanner_signatures_stale",
  "plaintext_cleanup_retry",
  "validation_retry_exhausted",
] as const;

export type FileValidationSafeErrorCode = (typeof fileValidationSafeErrorCodes)[number];

export const fileValidationLimits = {
  maxCiphertextBytes: 25 * 1024 * 1024 + 28,
  maxPlaintextBytes: 25 * 1024 * 1024,
  maxImageDimension: 16_384,
  maxImagePixels: 40_000_000,
  maxPdfJsonBytes: 16 * 1024 * 1024,
  maxPdfObjects: 100_000,
  maxPdfPages: 50,
  maxStructureDepth: 64,
  parserTimeoutMs: 30_000,
} as const;

const allowedTransitions: Readonly<Record<FileValidationState, ReadonlySet<FileValidationState>>> =
  {
    pending: new Set(["queued"]),
    queued: new Set(["validating"]),
    validating: new Set(["queued", "result_pending_cleanup"]),
    result_pending_cleanup: new Set(["queued", "ready", "rejected", "failed"]),
    ready: new Set(),
    rejected: new Set(),
    failed: new Set(["queued"]),
  };

export function canTransitionFileValidation(
  from: FileValidationState,
  to: FileValidationState,
): boolean {
  return allowedTransitions[from].has(to);
}

export function isTerminalFileValidationState(state: FileValidationState): boolean {
  return state === "ready" || state === "rejected" || state === "failed";
}
