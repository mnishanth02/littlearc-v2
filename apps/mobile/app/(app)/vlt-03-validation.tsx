import { createUuidV7 } from "@littlearc/domain";
import { getRandomBytes } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { readCaptureDraft, setCaptureDraftState } from "../../src/capture/repository";
import {
  addSourcesToCaptureDraft,
  createOrReadCaptureDraft,
  discardCaptureDraft,
} from "../../src/capture/service";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";
import {
  enrollLocalSecurity,
  inspectLocalSecurityCapability,
  openEncryptedLocalFilePreview,
  removeLocalFilePreview,
  wipeLocalSecurity,
  withUnlockedLocalDatabase,
} from "../../src/local-security/native";

const childId = "019d3157-2000-7000-8000-000000000003";
const deviceId = "019d3157-2000-7000-8000-000000000001";
const draftId = "019d3157-2000-7000-8000-000000000004";
const householdId = "019d3157-2000-7000-8000-000000000002";
const pngFixture =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const pdfFixture =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMjAgMjAwXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA1OSA+PgpzdHJlYW0KQlQgL0YxIDE4IFRmIDMwIDExMCBUZCAoU3ludGhldGljIExpdHRsZUFyYyBzb3VyY2UpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwMzQ4IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDE4CiUlRU9GCg==";

type ValidationState = "idle" | "running" | "prepared" | "passed" | "failed";

export default function Vlt03ValidationScreen() {
  const router = useRouter();
  const { hostPhase } = useLocalSearchParams<{ hostPhase?: string }>();
  const completedHostPhase = useRef<string | undefined>(undefined);
  const [state, setState] = useState<ValidationState>("idle");
  const [summary, setSummary] = useState<string>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: the host phase is the intentional trigger and the ref prevents repeats.
  useEffect(() => {
    if (!hostPhase || completedHostPhase.current === hostPhase) {
      return;
    }
    completedHostPhase.current = hostPhase;
    if (hostPhase === "prepare") {
      void run(prepareInterruptedDraft);
    } else if (hostPhase === "resume") {
      void run(resumeAndDiscardDraft);
    }
  }, [hostPhase]);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  async function run(action: () => Promise<string>) {
    setState("running");
    setSummary(undefined);
    try {
      const result = await action();
      setSummary(result);
      setState(hostPhase === "prepare" ? "prepared" : "passed");
    } catch {
      setSummary("The synthetic capture validation failed without exposing protected details.");
      setState("failed");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="screenTitle">
          VLT-03 capture validation
        </Typography>
        <Banner
          message="This development-only flow uses generated PNG and PDF fixtures. It wipes only this app installation's synthetic protected store."
          title="Synthetic evidence boundary"
          variant="warning"
        />
        <Typography>
          Prepare validates native type inspection, image normalization, PDF page counting,
          encrypted opaque storage, and thumbnail decryption. Resume must be run after the host
          terminates the app; it validates durable draft recovery and complete discard cleanup.
        </Typography>
        <View style={styles.actions}>
          <Button
            label="Prepare interrupted capture draft"
            loading={state === "running"}
            onPress={() => void run(prepareInterruptedDraft)}
            testID="vlt03-prepare"
          />
          <Button
            label="Resume and discard protected draft"
            loading={state === "running"}
            onPress={() => void run(resumeAndDiscardDraft)}
            testID="vlt03-resume"
            variant="secondary"
          />
          <Button
            label="Open production capture adapters"
            onPress={() => router.push(`/capture?draftId=${createUuidV7(getRandomBytes(10))}`)}
            testID="vlt03-open-production-capture"
            variant="secondary"
          />
        </View>
        {state === "running" ? (
          <Banner message="The native capture validation is running." title="Working" />
        ) : null}
        {state === "prepared" ? (
          <Banner
            message={summary ?? "The protected draft is ready for a host restart."}
            title="VLT-03 restart checkpoint ready"
            variant="attention"
          />
        ) : null}
        {state === "passed" ? (
          <Banner
            message={summary ?? "Capture validation passed."}
            title="VLT-03 device validation passed"
            variant="success"
          />
        ) : null}
        {state === "failed" ? (
          <Banner
            message={summary ?? "The VLT-03 validation flow could not continue."}
            title="VLT-03 validation stopped"
            variant="danger"
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

async function prepareInterruptedDraft(): Promise<string> {
  await wipeLocalSecurity();
  const capability = await inspectLocalSecurityCapability();
  if (!capability.strongBiometricReady) {
    throw new Error("Strong biometric protection is unavailable on this validation target.");
  }
  await enrollLocalSecurity({ deviceId, householdId });
  await withUnlockedLocalDatabase((database) =>
    database.runAsync(
      `insert into local_children (
        child_id, revision, payload_json, updated_at, deleted_at
      ) values (?, 1, ?, ?, null)`,
      childId,
      JSON.stringify({ childId, displayName: "Synthetic child" }),
      new Date().toISOString(),
    ),
  );
  await createOrReadCaptureDraft({ childId, draftId });

  const fixtureDirectory = new Directory(Paths.cache, "vlt03-device-validation");
  fixtureDirectory.create({ idempotent: true, intermediates: true });
  const png = writeFixture(fixtureDirectory, "source.png", pngFixture);
  let draft = await addSourcesToCaptureDraft({
    draftId,
    sourceKind: "gallery",
    uris: [png.uri],
  });
  const pdf = writeFixture(fixtureDirectory, "source.pdf", pdfFixture);
  draft = await addSourcesToCaptureDraft({
    draftId,
    sourceKind: "file",
    uris: [pdf.uri],
  });
  if (
    draft.assets.length !== 2 ||
    draft.assets[0]?.detectedMime !== "image/png" ||
    draft.assets[0]?.normalizedFileId === null ||
    draft.assets[1]?.detectedMime !== "application/pdf" ||
    draft.assets[1]?.pageCount !== 1 ||
    draft.assets[1]?.normalizedFileId !== null
  ) {
    throw new Error("Native PNG/PDF inspection returned unexpected protected metadata.");
  }
  if (png.exists || pdf.exists) {
    throw new Error("A plaintext picker fixture remained after protected import.");
  }

  await verifyOpaqueCiphertexts(draft);
  const imageAsset = draft.assets[0];
  if (!imageAsset) {
    throw new Error("The protected image metadata is unavailable.");
  }
  const preview = await withUnlockedLocalDatabase((database) =>
    openEncryptedLocalFilePreview(database, {
      extension: "jpg",
      fileId: imageAsset.thumbnailFileId,
    }),
  );
  const previewFile = new File(preview);
  const header = await previewFile.bytes();
  removeLocalFilePreview(preview);
  if (header[0] !== 0xff || header[1] !== 0xd8) {
    throw new Error("The encrypted thumbnail did not reopen as normalized JPEG.");
  }
  await withUnlockedLocalDatabase((database) =>
    setCaptureDraftState(database, {
      draftId,
      safeErrorCode: null,
      state: "processing",
      updatedAt: new Date().toISOString(),
    }),
  );
  return "PNG + PDF protected · plaintext removed · processing checkpoint persisted";
}

async function resumeAndDiscardDraft(): Promise<string> {
  const resumed = await createOrReadCaptureDraft({ childId, draftId });
  if (
    resumed.state !== "editing" ||
    resumed.safeErrorCode !== "capture_processing_failed" ||
    resumed.assets.length !== 2
  ) {
    throw new Error("The interrupted protected capture draft did not resume safely.");
  }
  const ciphertexts = await encryptedFilesForDraft(resumed);
  await discardCaptureDraft(draftId);
  const remaining = await withUnlockedLocalDatabase((database) =>
    readCaptureDraft(database, draftId),
  );
  if (remaining) {
    throw new Error("Discard left capture draft metadata in SQLCipher.");
  }
  if (ciphertexts.some((file) => file.exists)) {
    throw new Error("Discard left protected capture ciphertext on the device.");
  }
  return "Interrupted draft resumed · safe error preserved · metadata, keys, and ciphertext discarded";
}

async function verifyOpaqueCiphertexts(
  draft: NonNullable<Awaited<ReturnType<typeof readCaptureDraft>>>,
): Promise<void> {
  const ciphertexts = await encryptedFilesForDraft(draft);
  if (ciphertexts.length !== 5 || ciphertexts.some((file) => !file.exists || file.size <= 16)) {
    throw new Error("Protected capture ciphertexts were incomplete.");
  }
  for (const ciphertext of ciphertexts) {
    const header = await ciphertext.bytes();
    const exposesPng =
      header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    const exposesPdf =
      header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
    if (exposesPng || exposesPdf) {
      throw new Error("A protected capture file retained plaintext magic bytes.");
    }
  }
}

async function encryptedFilesForDraft(
  draft: NonNullable<Awaited<ReturnType<typeof readCaptureDraft>>>,
): Promise<ReadonlyArray<File>> {
  const ids = draft.assets.flatMap((asset) => [
    asset.originalFileId,
    ...(asset.normalizedFileId ? [asset.normalizedFileId] : []),
    asset.thumbnailFileId,
  ]);
  const rows = await withUnlockedLocalDatabase((database) =>
    database.getAllAsync<{ readonly opaqueName: string }>(
      `select opaque_name as "opaqueName" from local_encrypted_files
       where file_id in (${ids.map(() => "?").join(", ")})
       order by opaque_name`,
      ...ids,
    ),
  );
  if (rows.length !== ids.length) {
    throw new Error("SQLCipher metadata omitted a protected capture file.");
  }
  return rows.map(
    ({ opaqueName }) => new File(Paths.document, "littlearc-encrypted-files-v1", opaqueName),
  );
}

function writeFixture(directory: Directory, name: string, base64: string): File {
  const file = new File(directory, name);
  if (file.exists) {
    file.delete();
  }
  file.create({ overwrite: false });
  file.write(Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)));
  return file;
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    gap: theme.spacing.xs,
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
}));
