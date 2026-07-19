export const outboxDispatchStates = ["pending", "dispatched", "failed"] as const;
export type OutboxDispatchState = (typeof outboxDispatchStates)[number];

export type OutboxDispatchSnapshot = {
  readonly availableAt: string;
  readonly dispatchedAt: string | null;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly now: string;
};

export function outboxDispatchState(snapshot: OutboxDispatchSnapshot): OutboxDispatchState {
  if (snapshot.dispatchedAt) {
    return "dispatched";
  }

  if (snapshot.attempts >= snapshot.maxAttempts) {
    return "failed";
  }

  return "pending";
}

export function isOutboxDispatchable(snapshot: OutboxDispatchSnapshot): boolean {
  return (
    outboxDispatchState(snapshot) === "pending" &&
    Date.parse(snapshot.availableAt) <= Date.parse(snapshot.now)
  );
}
