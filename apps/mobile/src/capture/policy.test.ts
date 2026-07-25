import { describe, expect, it } from "vitest";
import {
  captureErrorMessage,
  maximumCaptureBytes,
  maximumCapturePages,
  validateCaptureInspection,
} from "./policy";

describe("VLT-03 capture policy", () => {
  it("accepts supported bounded images and PDFs", () => {
    expect(
      validateCaptureInspection({
        byteCount: 1_024,
        height: 800,
        mimeType: "image/jpeg",
        pageCount: 1,
        width: 600,
      }),
    ).toMatchObject({ accepted: true });
    expect(
      validateCaptureInspection({
        byteCount: maximumCaptureBytes,
        height: null,
        mimeType: "application/pdf",
        pageCount: maximumCapturePages,
        width: null,
      }),
    ).toMatchObject({ accepted: true });
  });

  it("rejects empty, oversized, unsupported, and invalid metadata", () => {
    expect(
      validateCaptureInspection({
        byteCount: 0,
        height: 1,
        mimeType: "image/png",
        pageCount: 1,
        width: 1,
      }),
    ).toEqual({ accepted: false, code: "capture_invalid_metadata" });
    expect(
      validateCaptureInspection({
        byteCount: maximumCaptureBytes + 1,
        height: 1,
        mimeType: "image/png",
        pageCount: 1,
        width: 1,
      }),
    ).toEqual({ accepted: false, code: "capture_size_limit" });
    expect(
      validateCaptureInspection({
        byteCount: 1,
        height: null,
        mimeType: "application/pdf",
        pageCount: 1,
        width: 20,
      }),
    ).toEqual({ accepted: false, code: "capture_invalid_metadata" });
  });

  it("enforces the aggregate draft page limit without changing existing state", () => {
    expect(
      validateCaptureInspection(
        {
          byteCount: 1_024,
          height: 800,
          mimeType: "image/heic",
          pageCount: 1,
          width: 600,
        },
        maximumCapturePages,
      ),
    ).toEqual({ accepted: false, code: "capture_page_limit" });
  });

  it("returns actionable text for every safe code", () => {
    const codes = [
      "capture_empty",
      "capture_invalid_metadata",
      "capture_page_limit",
      "capture_permission_denied",
      "capture_processing_failed",
      "capture_size_limit",
      "capture_storage_unavailable",
      "capture_unsupported_type",
    ] as const;
    expect(codes.map(captureErrorMessage).every((message) => message.length > 20)).toBe(true);
  });
});
