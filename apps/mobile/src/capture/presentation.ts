import type { LocalCaptureAsset } from "./repository";

const sourceLabels: Record<LocalCaptureAsset["sourceKind"], string> = {
  camera: "Camera",
  file: "File picker",
  gallery: "Photo library",
  scanner: "Document scanner",
  share: "Incoming share",
};

const mimeLabels: Record<LocalCaptureAsset["detectedMime"], string> = {
  "application/pdf": "PDF",
  "image/heic": "HEIC image",
  "image/jpeg": "JPEG image",
  "image/png": "PNG image",
};

export function captureAssetLabel(asset: LocalCaptureAsset): string {
  const pageLabel = `${asset.pageCount} ${asset.pageCount === 1 ? "page" : "pages"}`;
  return `${sourceLabels[asset.sourceKind]} · ${mimeLabels[asset.detectedMime]} · ${pageLabel} · ${formatBytes(asset.byteCount)}`;
}

export function captureDraftSummary(assets: ReadonlyArray<LocalCaptureAsset>): string {
  const pages = assets.reduce((total, asset) => total + asset.pageCount, 0);
  return `${assets.length} ${assets.length === 1 ? "source" : "sources"} · ${pages} ${pages === 1 ? "page" : "pages"}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
