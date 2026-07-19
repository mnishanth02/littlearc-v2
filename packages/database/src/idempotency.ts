import type { IdempotencyKey, MutationId, UuidV7 } from "@littlearc/domain";

export type IdempotencyScope = {
  readonly householdId: UuidV7;
  readonly actorId: UuidV7;
  readonly idempotencyKey: IdempotencyKey;
};

export type IdempotencyReservation = IdempotencyScope & {
  readonly mutationId: MutationId;
  readonly requestFingerprint: string;
};

export function idempotencyScopeKey(scope: IdempotencyScope): string {
  return `${scope.householdId}:${scope.actorId}:${scope.idempotencyKey}`;
}

export function assertReplayMatchesReservation(
  reservation: IdempotencyReservation,
  requestFingerprint: string,
): void {
  if (reservation.requestFingerprint !== requestFingerprint) {
    throw new Error("Idempotency-Key replay used a different request fingerprint.");
  }
}
