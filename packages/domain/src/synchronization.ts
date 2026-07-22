import type { MutationId } from "./primitives.js";

export const localMutationStatuses = [
  "pending",
  "pushing",
  "retrying",
  "applied",
  "duplicate",
  "conflict",
  "rejected",
] as const;

export type LocalMutationStatus = (typeof localMutationStatuses)[number];
export type DependencyReadiness = "blocked" | "failed" | "ready";
export type SyncFailureKind =
  | "authentication"
  | "authorization"
  | "validation"
  | "network"
  | "server";

const completedStatuses = new Set<LocalMutationStatus>(["applied", "duplicate"]);
const failedStatuses = new Set<LocalMutationStatus>(["conflict", "rejected"]);
const signOutRiskStatuses = new Set<LocalMutationStatus>([
  "pending",
  "pushing",
  "retrying",
  "conflict",
  "rejected",
]);

export function dependencyReadiness(
  dependencyIds: ReadonlyArray<MutationId>,
  statuses: ReadonlyMap<MutationId, LocalMutationStatus>,
): DependencyReadiness {
  let blocked = false;
  for (const dependencyId of dependencyIds) {
    const status = statuses.get(dependencyId);
    if (!status || status === "pending" || status === "pushing" || status === "retrying") {
      blocked = true;
      continue;
    }
    if (failedStatuses.has(status)) {
      return "failed";
    }
    if (!completedStatuses.has(status)) {
      blocked = true;
    }
  }
  return blocked ? "blocked" : "ready";
}

export function fullJitterRetryDelay(input: {
  readonly attempt: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly randomUnit: number;
}): number {
  const baseDelayMs = input.baseDelayMs ?? 1_000;
  const maxDelayMs = input.maxDelayMs ?? 300_000;
  if (!Number.isSafeInteger(input.attempt) || input.attempt < 1) {
    throw new Error("Retry attempt must be a positive safe integer.");
  }
  if (!Number.isFinite(input.randomUnit) || input.randomUnit < 0 || input.randomUnit >= 1) {
    throw new Error("Retry jitter source must be in the range [0, 1).");
  }
  if (
    !Number.isSafeInteger(baseDelayMs) ||
    baseDelayMs < 1 ||
    !Number.isSafeInteger(maxDelayMs) ||
    maxDelayMs < baseDelayMs
  ) {
    throw new Error("Retry delay bounds are invalid.");
  }
  const exponent = Math.min(input.attempt - 1, 30);
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** exponent);
  return Math.floor(input.randomUnit * (ceiling + 1));
}

export function isRetryableSyncFailure(kind: SyncFailureKind): boolean {
  return kind === "network" || kind === "server";
}

export function signOutRisk(statuses: ReadonlyArray<LocalMutationStatus>): {
  readonly riskyMutationCount: number;
  readonly requiresExplicitDiscard: boolean;
} {
  const riskyMutationCount = statuses.filter((status) => signOutRiskStatuses.has(status)).length;
  return {
    riskyMutationCount,
    requiresExplicitDiscard: riskyMutationCount > 0,
  };
}
