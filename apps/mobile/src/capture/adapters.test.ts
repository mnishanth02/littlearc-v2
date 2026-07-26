import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDocumentAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
  requestCameraPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  scanDocument: vi.fn(),
}));

vi.mock("react-native-document-scanner-plugin", () => ({
  default: { scanDocument: mocks.scanDocument },
}));
vi.mock("expo-image-picker", () => ({
  CameraType: { back: "back" },
  launchCameraAsync: mocks.launchCameraAsync,
  launchImageLibraryAsync: mocks.launchImageLibraryAsync,
  requestCameraPermissionsAsync: mocks.requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync: mocks.requestMediaLibraryPermissionsAsync,
}));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: mocks.getDocumentAsync }));
vi.mock("expo", () => ({ requireNativeModule: vi.fn() }));

import {
  acquireCameraSource,
  acquireDocumentSources,
  acquireGallerySources,
  acquireScannerSources,
} from "./adapters";

describe("VLT-03 capture adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves scanner and file cancellation as unchanged adapter results", async () => {
    mocks.scanDocument.mockResolvedValueOnce({ scannedImages: [] });
    mocks.getDocumentAsync.mockResolvedValueOnce({ canceled: true });

    await expect(acquireScannerSources(8)).resolves.toEqual({
      canceled: true,
      sourceKind: "scanner",
      uris: [],
    });
    await expect(acquireDocumentSources()).resolves.toEqual({
      canceled: true,
      sourceKind: "file",
      uris: [],
    });
    expect(mocks.scanDocument).toHaveBeenCalledWith({ maxNumDocuments: 8 });
    expect(mocks.getDocumentAsync).toHaveBeenCalledWith(
      expect.objectContaining({ copyToCacheDirectory: true, multiple: true }),
    );
  });

  it("maps camera permission denial to the bounded safe error", async () => {
    mocks.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });

    await expect(acquireCameraSource()).rejects.toMatchObject({
      code: "capture_permission_denied",
      name: "CaptureProcessingError",
    });
    expect(mocks.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("requests multi-image gallery selection and returns only accepted URIs", async () => {
    mocks.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: true });
    mocks.launchImageLibraryAsync.mockResolvedValueOnce({
      assets: [{ uri: "file:///one.png" }, { uri: "file:///two.jpg" }],
      canceled: false,
    });

    await expect(acquireGallerySources(3)).resolves.toEqual({
      canceled: false,
      sourceKind: "gallery",
      uris: ["file:///one.png", "file:///two.jpg"],
    });
    expect(mocks.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsMultipleSelection: true,
        selectionLimit: 3,
      }),
    );
  });
});
