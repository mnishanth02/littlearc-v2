import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ processAsync: vi.fn() }));

vi.mock("expo", () => ({
  requireNativeModule: vi.fn(() => ({ processAsync: mocks.processAsync })),
}));

import { processCaptureSource } from "./native-processor";

const input = {
  opaqueBaseName: "019f742b-de82-7292-86cd-5475a1388314",
  outputDirectoryUri: "file:///private/capture/",
  sourceUri: "file:///private/source.png",
  thumbnailDimension: 512,
} as const;

describe("VLT-03 native processor boundary", () => {
  beforeEach(() => {
    mocks.processAsync.mockReset();
  });

  it("returns the native inspection without exposing provider metadata", async () => {
    mocks.processAsync.mockResolvedValueOnce({
      byteCount: 128,
      height: 1,
      mimeType: "image/png",
      normalizedUri: "file:///private/capture/normalized.jpg",
      originalUri: "file:///private/capture/original.png",
      pageCount: 1,
      thumbnailUri: "file:///private/capture/thumbnail.jpg",
      width: 1,
    });

    await expect(processCaptureSource(input)).resolves.toMatchObject({
      mimeType: "image/png",
      pageCount: 1,
    });
    expect(mocks.processAsync).toHaveBeenCalledWith(
      input.sourceUri,
      input.outputDirectoryUri,
      input.opaqueBaseName,
      input.thumbnailDimension,
    );
  });

  it("preserves allowlisted native codes and collapses unknown failures", async () => {
    mocks.processAsync.mockRejectedValueOnce({ code: "capture_page_limit" });
    await expect(processCaptureSource(input)).rejects.toMatchObject({
      code: "capture_page_limit",
      name: "CaptureProcessingError",
    });

    mocks.processAsync.mockRejectedValueOnce({
      code: "provider-secret-error",
      message: "file:///private/provider/secret.pdf",
    });
    await expect(processCaptureSource(input)).rejects.toMatchObject({
      code: "capture_processing_failed",
      message: "The capture source could not be processed safely.",
    });
  });
});
