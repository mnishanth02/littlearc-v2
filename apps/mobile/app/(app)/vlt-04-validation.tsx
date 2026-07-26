import { createUuidV7 } from "@littlearc/domain";
import Constants from "expo-constants";
import { getRandomBytes } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { getMobileEnvironment } from "../../src/bootstrap/environment";
import { appendCaptureAsset, createCaptureDraft } from "../../src/capture/repository";
import {
  downloadEncryptedFileObject,
  readCaptureUpload,
  uploadCaptureAsset,
} from "../../src/capture/upload";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";
import {
  enrollLocalSecurity,
  storeEncryptedLocalFile,
  validateUnlockedLocalSecurity,
  wipeLocalSecurity,
  withUnlockedLocalDatabase,
} from "../../src/local-security/native";

const validationHeaders = {
  "x-littlearc-synthetic-session": "vlt04-device-validation",
} as const;
const plaintextBytes = 5 * 1024 * 1024 + 1024;

type ValidationState = "idle" | "running" | "passed" | "failed";

export default function Vlt04ValidationScreen() {
  const environment = getMobileEnvironment();
  const { autoRun } = useLocalSearchParams<{ autoRun?: string }>();
  const deviceId = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const autoRunStarted = useRef(false);
  const [state, setState] = useState<ValidationState>("idle");
  const [summary, setSummary] = useState<string>();

  const request = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const response = await fetch(`${environment.apiBaseUrl}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...validationHeaders,
          ...(init?.headers ?? {}),
        },
      });
      if (!response.ok) {
        throw new Error(`Synthetic VLT-04 request returned HTTP ${response.status}.`);
      }
      return response;
    },
    [environment.apiBaseUrl],
  );

  const validateFlow = useCallback(async (): Promise<void> => {
    setState("running");
    setSummary(undefined);
    try {
      await wipeLocalSecurity();
      const bootstrap = (await (
        await request("/v1/validation/vlt04/bootstrap", {
          body: JSON.stringify({
            appVersion: Constants.expoConfig?.version ?? "0.0.1",
            deviceId,
            platform: process.env.EXPO_OS === "ios" ? "ios" : "android",
          }),
          method: "POST",
        })
      ).json()) as { childId: string; householdId: string };
      await enrollLocalSecurity({ deviceId, householdId: bootstrap.householdId });
      const security = await validateUnlockedLocalSecurity();
      if (security.migrationVersion !== 8 || !security.reopenPassed) {
        throw new Error("SQLCipher schema V8 did not survive a keyed reopen.");
      }

      const assetId = createUuidV7(getRandomBytes(10));
      const draftId = createUuidV7(getRandomBytes(10));
      const fileObjectId = createUuidV7(getRandomBytes(10));
      const thumbnailFileId = createUuidV7(getRandomBytes(10));
      const fixtureDirectory = new Directory(Paths.cache, "vlt04-device-validation");
      fixtureDirectory.create({ idempotent: true, intermediates: true });
      const source = writeFixture(
        fixtureDirectory,
        "synthetic-document.pdf",
        new Uint8Array(plaintextBytes).fill(0x56),
      );
      const thumbnail = writeFixture(
        fixtureDirectory,
        "synthetic-thumbnail.jpg",
        new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0xff, 0xd9]),
      );
      await withUnlockedLocalDatabase(async (database) => {
        const now = new Date().toISOString();
        await database.runAsync(
          `insert into local_children (
             child_id, revision, payload_json, updated_at, deleted_at
           ) values (?, 1, ?, ?, null)`,
          bootstrap.childId,
          JSON.stringify({ childId: bootstrap.childId, displayName: "Synthetic child" }),
          now,
        );
        await createCaptureDraft(database, {
          childId: bootstrap.childId,
          createdAt: now,
          draftId,
        });
        await storeEncryptedLocalFile(database, {
          fileId: fileObjectId,
          plaintextUri: source.uri,
          purpose: "capture-original",
          transport: {
            format: "application/pdf",
            householdId: bootstrap.householdId,
            objectId: fileObjectId,
          },
        });
        await storeEncryptedLocalFile(database, {
          fileId: thumbnailFileId,
          plaintextUri: thumbnail.uri,
          purpose: "capture-thumbnail",
        });
        await appendCaptureAsset(database, {
          assetId,
          byteCount: plaintextBytes,
          createdAt: now,
          detectedMime: "application/pdf",
          displayOrder: 0,
          draftId,
          height: null,
          normalizedFileId: null,
          originalFileId: fileObjectId,
          pageCount: 1,
          sourceKind: "file",
          thumbnailFileId,
          width: null,
        });
      });
      source.delete();
      thumbnail.delete();
      if (fixtureDirectory.exists && fixtureDirectory.list().length === 0) {
        fixtureDirectory.delete();
      }

      let interrupted = false;
      let interruptionMessage = "none";
      try {
        await uploadCaptureAsset(assetId, { headers: validationHeaders });
      } catch (error) {
        interrupted = true;
        interruptionMessage = error instanceof Error ? error.message : "unknown";
      }
      const failed = await readCaptureUpload(assetId);
      if (!interrupted || failed?.state !== "failed" || failed.parts.length !== 1) {
        throw new Error(
          `The multipart interruption state was ${failed?.state ?? "missing"} with ${
            failed?.parts.length ?? 0
          } preserved parts after: ${interruptionMessage}.`,
        );
      }

      const resumed = await uploadCaptureAsset(assetId, { headers: validationHeaders });
      if (resumed.state !== "uploaded" || resumed.parts.length !== 2) {
        throw new Error("The multipart upload did not resume and complete from its saved part.");
      }

      await request("/v1/validation/vlt04/tamper-next-download", { method: "POST" });
      let tamperRejected = false;
      try {
        await downloadEncryptedFileObject(fileObjectId, { headers: validationHeaders });
      } catch {
        tamperRejected = true;
      }
      if (!tamperRejected) {
        throw new Error("Tampered encrypted download content was accepted.");
      }
      await downloadEncryptedFileObject(fileObjectId, { headers: validationHeaders });

      const evidence = (await (await request("/v1/validation/vlt04/evidence")).json()) as {
        completed: string;
        created: string;
        downloaded: string;
        files: string;
      };
      if (
        evidence.files !== "1" ||
        evidence.created !== "1" ||
        evidence.completed !== "1" ||
        Number(evidence.downloaded) < 2
      ) {
        throw new Error("The encrypted file database/audit evidence was incomplete.");
      }

      setSummary(
        "SQLCipher V8 · 2-part encrypted upload · interrupted after part 1 · resumed without replay · authenticated download · tamper rejected",
      );
      setState("passed");
    } catch (error) {
      setSummary(
        error instanceof Error
          ? error.message
          : "The synthetic file-upload proof stopped without exposing protected details.",
      );
      setState("failed");
    }
  }, [deviceId, request]);

  useEffect(() => {
    if (__DEV__ && autoRun === "true" && !autoRunStarted.current) {
      autoRunStarted.current = true;
      void validateFlow();
    }
  }, [autoRun, validateFlow]);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="screenTitle">
          VLT-04 encrypted upload validation
        </Typography>
        <Banner
          message="This development-only proof uses generated bytes, a disposable Aiven database, and an in-memory multipart provider. It is not real child data, physical-iOS evidence, or Gate 2 closure."
          title="Synthetic evidence boundary"
          variant="warning"
        />
        <Typography>
          The proof encrypts before transport, forces the second multipart request to fail once,
          resumes from the persisted first part, then verifies authenticated download and tamper
          rejection.
        </Typography>
        <Button
          label="Run encrypted resumable upload proof"
          loading={state === "running"}
          onPress={() => void validateFlow()}
          testID="vlt04-run"
        />
        {state === "passed" ? (
          <Banner
            message={summary ?? "Encrypted resumable upload validation passed."}
            title="VLT-04 device validation passed"
            variant="success"
          />
        ) : null}
        {state === "failed" ? (
          <Banner
            message={summary ?? "The VLT-04 validation flow could not continue."}
            title="VLT-04 validation stopped"
            variant="danger"
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

function writeFixture(directory: Directory, name: string, bytes: Uint8Array): File {
  const file = new File(directory, name);
  if (file.exists) {
    file.delete();
  }
  file.create({ overwrite: false });
  file.write(bytes);
  return file;
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flexGrow: 1,
    justifyContent: "center",
    padding: theme.layout.screenPadding,
  },
}));
