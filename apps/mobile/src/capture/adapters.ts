import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import DocumentScanner from "react-native-document-scanner-plugin";
import { CaptureProcessingError } from "./native-processor";
import type { CaptureSourceKind } from "./policy";

export type CaptureAdapterResult = {
  readonly canceled: boolean;
  readonly sourceKind: CaptureSourceKind;
  readonly uris: ReadonlyArray<string>;
};

export async function acquireScannerSources(remainingPages: number): Promise<CaptureAdapterResult> {
  const result = await DocumentScanner.scanDocument({
    maxNumDocuments: Math.max(1, remainingPages),
  });
  return {
    canceled: (result.scannedImages?.length ?? 0) === 0,
    sourceKind: "scanner",
    uris: result.scannedImages ?? [],
  };
}

export async function acquireCameraSource(): Promise<CaptureAdapterResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new CaptureProcessingError("capture_permission_denied");
  }
  const result = await ImagePicker.launchCameraAsync({
    cameraType: ImagePicker.CameraType.back,
    exif: false,
    mediaTypes: ["images"],
    quality: 1,
  });
  return {
    canceled: result.canceled,
    sourceKind: "camera",
    uris: result.canceled ? [] : result.assets.map((asset) => asset.uri),
  };
}

export async function acquireGallerySources(remainingPages: number): Promise<CaptureAdapterResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new CaptureProcessingError("capture_permission_denied");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    exif: false,
    mediaTypes: ["images"],
    orderedSelection: true,
    quality: 1,
    selectionLimit: Math.max(1, remainingPages),
  });
  return {
    canceled: result.canceled,
    sourceKind: "gallery",
    uris: result.canceled ? [] : result.assets.map((asset) => asset.uri),
  };
}

export async function acquireDocumentSources(): Promise<CaptureAdapterResult> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
    type: ["image/jpeg", "image/png", "image/heic", "image/heif", "application/pdf"],
  });
  return {
    canceled: result.canceled,
    sourceKind: "file",
    uris: result.canceled ? [] : result.assets.map((asset) => asset.uri),
  };
}
