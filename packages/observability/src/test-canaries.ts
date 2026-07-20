import type { SensitiveCanary } from "./canary.js";

export const sensitiveCanaries = [
  { label: "child-name", value: "CANARY_CHILD_AMARA" },
  { label: "email", value: "canary-parent@example.test" },
  { label: "birth-date", value: "2019-02-17" },
  { label: "ocr-text", value: "CANARY_OCR_PRESCRIPTION_TEXT" },
  { label: "token", value: "canary_secret_token_47a9" },
  { label: "file-path", value: "/private/canary/medical-record.pdf" },
  { label: "record-title", value: "CANARY_PEDIATRIC_VISIT_TITLE" },
] as const satisfies ReadonlyArray<SensitiveCanary>;
