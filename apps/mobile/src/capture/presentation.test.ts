import { describe, expect, it } from "vitest";
import { captureAssetLabel, captureDraftSummary } from "./presentation";
import type { LocalCaptureAsset } from "./repository";

const asset: LocalCaptureAsset = {
  assetId: "opaque-asset",
  byteCount: 1_572_864,
  createdAt: "2026-07-24T12:00:00.000Z",
  detectedMime: "application/pdf",
  displayOrder: 0,
  draftId: "opaque-draft",
  height: null,
  normalizedFileId: null,
  originalFileId: "opaque-original",
  pageCount: 2,
  sourceKind: "share",
  thumbnailFileId: "opaque-thumbnail",
  width: null,
};

describe("VLT-03 capture presentation", () => {
  it("uses generic source/type/count labels without names or identifiers", () => {
    expect(captureAssetLabel(asset)).toBe("Incoming share · PDF · 2 pages · 1.5 MB");
    expect(captureAssetLabel(asset)).not.toContain(asset.assetId);
  });

  it("summarizes ordered draft sources and pages textually", () => {
    expect(captureDraftSummary([asset, { ...asset, assetId: "second", pageCount: 1 }])).toBe(
      "2 sources · 3 pages",
    );
  });
});
