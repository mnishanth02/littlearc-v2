import { createUuidV7 } from "@littlearc/domain";
import { getRandomBytes } from "expo-crypto";
import { useIncomingShare } from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Typography } from "../components/ui/Typography";
import {
  openEncryptedLocalFilePreview,
  removeLocalFilePreview,
  withUnlockedLocalDatabase,
} from "../local-security/native";
import {
  acquireCameraSource,
  acquireDocumentSources,
  acquireGallerySources,
  acquireScannerSources,
  type CaptureAdapterResult,
} from "./adapters";
import { captureErrorMessage, maximumCapturePages } from "./policy";
import { captureAssetLabel, captureDraftSummary } from "./presentation";
import type { LocalCaptureAsset, LocalCaptureDraft } from "./repository";
import {
  addSourcesToCaptureDraft,
  captureSafeCode,
  createOrReadCaptureDraft,
  discardCaptureDraft,
} from "./service";
import { cancelCaptureUpload, readCaptureUpload, uploadCaptureAsset } from "./upload";
import type { LocalUploadSession } from "./upload-repository";

type CaptureScreenState =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly draft: LocalCaptureDraft; readonly kind: "ready" };

export function CaptureDraftScreen(props: {
  readonly draftId: string | undefined;
  readonly incomingShare: boolean;
  readonly onDraftId: (draftId: string) => void;
  readonly onExit: () => void;
}) {
  const { draftId, incomingShare, onDraftId, onExit } = props;
  const generatedDraftId = useRef(draftId ?? createUuidV7(getRandomBytes(10))).current;
  const [state, setState] = useState<CaptureScreenState>({ kind: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const handledIncomingShare = useRef(false);
  const incoming = useIncomingShare();

  useEffect(() => {
    let active = true;
    void loadDraft(generatedDraftId).then((next) => {
      if (active) {
        setState(next);
        if (next.kind === "ready" && !draftId) {
          onDraftId(next.draft.draftId);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [draftId, generatedDraftId, onDraftId]);

  useEffect(() => {
    if (
      !incomingShare ||
      handledIncomingShare.current ||
      state.kind !== "ready" ||
      busy !== null ||
      incoming.isResolving ||
      incoming.resolvedSharedPayloads.length === 0
    ) {
      return;
    }
    handledIncomingShare.current = true;
    const uris = incoming.resolvedSharedPayloads.flatMap((payload) =>
      (payload.contentType === "image" || payload.contentType === "file") && payload.contentUri
        ? [payload.contentUri]
        : [],
    );
    void runAdapter(
      { canceled: uris.length === 0, sourceKind: "share", uris },
      "incoming share",
      state.draft,
      setBusy,
      setMessage,
      setState,
    ).finally(() => incoming.clearSharedPayloads());
  }, [busy, incoming, incomingShare, state]);

  const draft = state.kind === "ready" ? state.draft : null;
  const remainingPages =
    maximumCapturePages - (draft?.assets.reduce((total, asset) => total + asset.pageCount, 0) ?? 0);

  async function acquire(label: string, operation: () => Promise<CaptureAdapterResult>) {
    if (!draft || busy !== null) {
      return;
    }
    setBusy(label);
    setMessage(null);
    try {
      const result = await operation();
      await runAdapter(result, label, draft, setBusy, setMessage, setState);
    } catch (error) {
      setMessage(captureErrorMessage(captureSafeCode(error)));
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="display">
          Capture a record source
        </Typography>
        <Banner
          message="Use synthetic sources only in this environment. LittleArc encrypts accepted sources before transport. An uploaded source is still pending safety validation and is not yet a confirmed health record."
          title="Protected capture draft"
          variant="info"
        />
        <Banner
          message="Camera and photo access is requested only after you choose that source. You can use a file instead, and cancellation never removes an existing draft."
          title="Choose when to grant access"
          variant="attention"
        />
        {state.kind === "loading" ? (
          <Banner message="Unlocking the protected capture draft…" title="Loading" />
        ) : null}
        {state.kind === "unavailable" ? (
          <Banner
            message="An enrolled local child profile is required before capture."
            title="Capture unavailable"
            variant="warning"
          />
        ) : null}
        {draft ? (
          <>
            <Typography accessibilityRole="header" textRole="sectionTitle">
              Add a source
            </Typography>
            <View style={styles.actions}>
              <Button
                disabled={busy !== null || remainingPages <= 0}
                label="Scan document pages"
                loading={busy === "scanner"}
                onPress={() => void acquire("scanner", () => acquireScannerSources(remainingPages))}
                testID="capture-scanner"
                variant="secondary"
              />
              <Button
                disabled={busy !== null || remainingPages <= 0}
                label="Take a photo"
                loading={busy === "camera"}
                onPress={() => void acquire("camera", acquireCameraSource)}
                testID="capture-camera"
                variant="secondary"
              />
              <Button
                disabled={busy !== null || remainingPages <= 0}
                label="Choose photos"
                loading={busy === "gallery"}
                onPress={() => void acquire("gallery", () => acquireGallerySources(remainingPages))}
                testID="capture-gallery"
                variant="secondary"
              />
              <Button
                disabled={busy !== null || remainingPages <= 0}
                label="Choose images or PDF"
                loading={busy === "file"}
                onPress={() => void acquire("file", acquireDocumentSources)}
                testID="capture-file"
                variant="secondary"
              />
            </View>
            {busy ? (
              <Banner
                message="LittleArc is validating, normalizing, and encrypting this source. Keep the app open until this step finishes."
                title={`Preparing ${busy}`}
              />
            ) : null}
            {message ? (
              <Banner message={message} title="Source not added" variant="danger" />
            ) : null}
            {draft.safeErrorCode && !message ? (
              <Banner
                message={captureErrorMessage(draft.safeErrorCode)}
                title="Previous source not added"
                variant="warning"
              />
            ) : null}
            <Typography accessibilityRole="header" textRole="sectionTitle">
              Protected draft
            </Typography>
            <Typography tone="secondary">{captureDraftSummary(draft.assets)}</Typography>
            {draft.assets.length === 0 ? (
              <Typography tone="muted">No accepted sources yet.</Typography>
            ) : (
              draft.assets.map((asset) => <CaptureAssetCard asset={asset} key={asset.assetId} />)
            )}
            <View style={styles.actions}>
              <Button
                disabled={busy !== null}
                label="Keep draft and return"
                onPress={onExit}
                testID="capture-keep-draft"
              />
              <Button
                disabled={busy !== null}
                label={confirmingDiscard ? "Confirm discard protected draft" : "Discard draft"}
                onPress={() => {
                  if (!confirmingDiscard) {
                    setConfirmingDiscard(true);
                    return;
                  }
                  setBusy("discard");
                  void discardCaptureDraft(draft.draftId)
                    .then(onExit)
                    .catch((error) => {
                      setMessage(captureErrorMessage(captureSafeCode(error)));
                      setBusy(null);
                    });
                }}
                testID={confirmingDiscard ? "capture-confirm-discard" : "capture-discard-draft"}
                variant="destructive"
              />
            </View>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function CaptureAssetCard(props: { readonly asset: LocalCaptureAsset }) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [upload, setUpload] = useState<LocalUploadSession | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let active = true;
    let uri: string | undefined;
    void withUnlockedLocalDatabase((database) =>
      openEncryptedLocalFilePreview(database, {
        extension: "jpg",
        fileId: props.asset.thumbnailFileId,
      }),
    )
      .then((opened) => {
        uri = opened;
        if (active) {
          setPreviewUri(opened);
        } else {
          removeLocalFilePreview(opened);
        }
      })
      .catch(() => {
        if (active) {
          setPreviewFailed(true);
        }
      });
    return () => {
      active = false;
      if (uri) {
        removeLocalFilePreview(uri);
      }
    };
  }, [props.asset.thumbnailFileId]);

  useEffect(() => {
    let active = true;
    void readCaptureUpload(props.asset.assetId)
      .then((session) => {
        if (active) {
          setUpload(session);
          setProgress(
            session
              ? session.parts.reduce((total, part) => total + part.byteCount, 0) /
                  session.expectedCiphertextBytes
              : 0,
          );
        }
      })
      .catch(() => {
        if (active) {
          setUploadMessage("Upload status is unavailable until local data is unlocked.");
        }
      });
    return () => {
      active = false;
    };
  }, [props.asset.assetId]);

  async function startUpload(): Promise<void> {
    setUploadBusy(true);
    setUploadMessage(null);
    try {
      const result = await uploadCaptureAsset(props.asset.assetId, {
        onProgress(next) {
          setProgress(next.totalBytes === 0 ? 0 : next.completedBytes / next.totalBytes);
        },
      });
      setUpload(result);
    } catch {
      setUpload(await readCaptureUpload(props.asset.assetId).catch(() => null));
      setUploadMessage(
        "Upload paused safely. The encrypted source remains on this device and can be retried.",
      );
    } finally {
      setUploadBusy(false);
    }
  }

  async function cancelUpload(): Promise<void> {
    setUploadBusy(true);
    setUploadMessage(null);
    try {
      await cancelCaptureUpload(props.asset.assetId);
      setUpload(await readCaptureUpload(props.asset.assetId));
      setUploadMessage("Upload cancelled. The encrypted local source was preserved.");
    } catch {
      setUploadMessage("The upload could not be cancelled safely. Try again when online.");
    } finally {
      setUploadBusy(false);
    }
  }

  const uploadState = upload?.state;
  const canUpload =
    !uploadState ||
    uploadState === "created" ||
    uploadState === "expired" ||
    uploadState === "failed";
  const canCancel =
    uploadState === "created" ||
    uploadState === "uploading" ||
    uploadState === "completing" ||
    uploadState === "failed";

  return (
    <View
      accessibilityLabel={`Protected source. ${captureAssetLabel(props.asset)}`}
      style={styles.asset}
    >
      {previewUri ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Protected source thumbnail"
          source={{ uri: previewUri }}
          style={styles.thumbnail}
          testID={`capture-thumbnail-${props.asset.displayOrder}`}
        />
      ) : null}
      {previewFailed ? <Typography tone="muted">Thumbnail unavailable.</Typography> : null}
      <Typography textRole="bodyEmphasis">{captureAssetLabel(props.asset)}</Typography>
      <Typography tone="muted">
        {uploadState === "uploaded"
          ? "Encrypted upload verified · safety validation pending"
          : uploadState === "cancelled"
            ? "Encrypted on this device · upload cancelled"
            : uploadState
              ? `Encrypted upload ${uploadState} · ${Math.round(progress * 100)}%`
              : "Encrypted on this device · ready to upload"}
      </Typography>
      {uploadMessage ? <Typography tone="secondary">{uploadMessage}</Typography> : null}
      {uploadState !== "cancelled" && uploadState !== "uploaded" ? (
        <View style={styles.actions}>
          {canUpload ? (
            <Button
              disabled={uploadBusy}
              label={uploadState ? "Retry encrypted upload" : "Upload encrypted source"}
              loading={uploadBusy}
              onPress={() => void startUpload()}
              testID={`capture-upload-${props.asset.displayOrder}`}
              variant="secondary"
            />
          ) : null}
          {canCancel ? (
            <Button
              disabled={uploadBusy}
              label="Cancel upload"
              onPress={() => void cancelUpload()}
              testID={`capture-cancel-upload-${props.asset.displayOrder}`}
              variant="destructive"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

async function loadDraft(draftId: string): Promise<CaptureScreenState> {
  const child = await withUnlockedLocalDatabase((database) =>
    database.getFirstAsync<{ readonly childId: string }>(
      `select child_id as "childId" from local_children
       where deleted_at is null order by child_id limit 1`,
    ),
  );
  if (!child) {
    return { kind: "unavailable" };
  }
  return {
    draft: await createOrReadCaptureDraft({ childId: child.childId, draftId }),
    kind: "ready",
  };
}

async function runAdapter(
  result: CaptureAdapterResult,
  label: string,
  draft: LocalCaptureDraft,
  setBusy: (value: string | null) => void,
  setMessage: (value: string | null) => void,
  setState: (value: CaptureScreenState) => void,
): Promise<void> {
  if (result.canceled) {
    setMessage(
      `${label[0]?.toUpperCase() ?? ""}${label.slice(1)} canceled. Your draft is unchanged.`,
    );
    setBusy(null);
    return;
  }
  try {
    const updated = await addSourcesToCaptureDraft({
      draftId: draft.draftId,
      sourceKind: result.sourceKind,
      uris: result.uris,
    });
    setState({ draft: updated, kind: "ready" });
    setMessage(null);
  } catch (error) {
    setMessage(captureErrorMessage(captureSafeCode(error)));
  } finally {
    setBusy(null);
  }
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    gap: theme.spacing.xs,
  },
  asset: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
  },
  content: {
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flexGrow: 1,
    padding: theme.layout.screenPadding,
    paddingVertical: theme.spacing.lg,
  },
  thumbnail: {
    aspectRatio: 1.4,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.control,
    resizeMode: "contain",
    width: "100%",
  },
}));
