import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { CaptureDraftScreen } from "../../../src/capture/CaptureDraftScreen";

export default function CaptureScreenRoute() {
  const router = useRouter();
  const parameters = useLocalSearchParams<{
    readonly draftId?: string | string[];
    readonly source?: string | string[];
  }>();
  const handleDraftId = useCallback((draftId: string) => router.setParams({ draftId }), [router]);
  const handleExit = useCallback(() => router.replace("/records"), [router]);
  return (
    <CaptureDraftScreen
      draftId={scalar(parameters.draftId)}
      incomingShare={scalar(parameters.source) === "share"}
      onDraftId={handleDraftId}
      onExit={handleExit}
    />
  );
}

function scalar(value: string | ReadonlyArray<string> | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}
