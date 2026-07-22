export const localSchemaVersion = 3 as const;
export const localAppLockPolicy = "strong_biometric" as const;

export type ProtectedKeyState = "available" | "cancelled" | "missing" | "unavailable";
export type LocalSecurityState = "not_enrolled" | "locked" | "ready" | "reauthentication_required";

export function resolveLocalSecurityState(input: {
  readonly enrollmentMarkerPresent: boolean;
  readonly protectedKeyState: ProtectedKeyState;
}): LocalSecurityState {
  if (!input.enrollmentMarkerPresent) {
    return "not_enrolled";
  }
  if (input.protectedKeyState === "available") {
    return "ready";
  }
  if (input.protectedKeyState === "missing") {
    return "reauthentication_required";
  }
  return "locked";
}

export type LocalEnrollmentMarker = {
  readonly appLockPolicy: typeof localAppLockPolicy;
  readonly deviceId: string;
  readonly generationId: string;
  readonly householdId: string;
  readonly localSchemaVersion: 1 | 2 | typeof localSchemaVersion;
};

export function parseLocalEnrollmentMarker(value: string): LocalEnrollmentMarker {
  const parsed = JSON.parse(value) as Partial<LocalEnrollmentMarker>;
  if (
    parsed.appLockPolicy !== localAppLockPolicy ||
    !isUuidV7(parsed.deviceId) ||
    !isUuidV7(parsed.generationId) ||
    !isUuidV7(parsed.householdId) ||
    (parsed.localSchemaVersion !== 1 &&
      parsed.localSchemaVersion !== 2 &&
      parsed.localSchemaVersion !== localSchemaVersion)
  ) {
    throw new Error("The local enrollment marker is invalid.");
  }
  return parsed as LocalEnrollmentMarker;
}

export async function runSignOutWithLocalWipe(input: {
  readonly remoteSignOut: () => Promise<unknown>;
  readonly wipeLocalSecurity: () => Promise<void>;
}): Promise<void> {
  try {
    await input.remoteSignOut();
  } finally {
    await input.wipeLocalSecurity();
  }
}

function isUuidV7(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
