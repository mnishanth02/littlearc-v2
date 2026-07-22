import {
  syncMutationPushResponseSchema,
  syncPullResponseSchema,
  syncSnapshotPageSchema,
} from "@littlearc/contracts";
import { fullJitterRetryDelay } from "@littlearc/domain";
import {
  applyChangePage,
  applyMutationResults,
  beginSnapshot,
  finalizeSnapshot,
  type LocalSyncDatabase,
  listReadyMutations,
  markMutationsPushing,
  markMutationsRetrying,
  pauseMutationsForAuthentication,
  readSyncCursor,
  stageSnapshotPage,
} from "./repository";

export type SyncRunResult = {
  readonly appliedChangeCount: number;
  readonly mutationCount: number;
  readonly resetPerformed: boolean;
};

export class SyncRunError extends Error {
  readonly kind: "authentication" | "network" | "server" | "validation";

  constructor(kind: SyncRunError["kind"], message: string) {
    super(message);
    this.name = "SyncRunError";
    this.kind = kind;
  }
}

export async function runSynchronization(input: {
  readonly apiBaseUrl: string;
  readonly database: LocalSyncDatabase;
  readonly fetch?: typeof globalThis.fetch;
  readonly headers?: Readonly<Record<string, string>>;
  readonly householdId: string;
  readonly now?: () => Date;
  readonly random?: () => number;
}): Promise<SyncRunResult> {
  const fetcher = input.fetch ?? globalThis.fetch;
  const now = input.now ?? (() => new Date());
  const random = input.random ?? Math.random;
  const ready = await listReadyMutations(input.database, {
    limit: 50,
    now: now().toISOString(),
  });
  if (ready.length > 0) {
    const mutationIds = ready.map((mutation) => mutation.mutationId);
    await markMutationsPushing(input.database, mutationIds, now().toISOString());
    let response: Response;
    try {
      response = await fetcher(`${input.apiBaseUrl}/v1/sync/mutations`, {
        body: JSON.stringify({
          mutations: ready.map((mutation) => ({
            baseRevision: mutation.baseRevision,
            entityId: mutation.entityId,
            entityType: "child",
            idempotencyKey: mutation.idempotencyKey,
            localDependencyIds: mutation.localDependencyIds,
            mutationId: mutation.mutationId,
            operation: "update",
            payload: mutation.payload,
          })),
        }),
        credentials: "include",
        headers: requestHeaders(input.headers),
        method: "POST",
      });
    } catch {
      await retryMutations(input.database, ready, mutationIds, now, random, "networkUnavailable");
      throw new SyncRunError("network", "Synchronization could not reach the server.");
    }
    if (response.status === 401) {
      await pauseMutationsForAuthentication(input.database, mutationIds, now().toISOString());
      throw new SyncRunError("authentication", "Synchronization requires authentication.");
    }
    if (response.status >= 500) {
      await retryMutations(input.database, ready, mutationIds, now, random, "serverUnavailable");
      throw new SyncRunError("server", "Synchronization will retry after a server error.");
    }
    if (!response.ok) {
      await retryMutations(input.database, ready, mutationIds, now, random, "invalidBatchResponse");
      throw new SyncRunError("validation", "The synchronization mutation batch was rejected.");
    }
    const body = syncMutationPushResponseSchema.parse(await response.json());
    await applyMutationResults(input.database, body.results, now().toISOString());
  }

  let cursor = await readSyncCursor(input.database, input.householdId);
  let appliedChangeCount = 0;
  let resetPerformed = false;
  while (true) {
    const url = new URL(`${input.apiBaseUrl}/v1/sync`);
    url.searchParams.set("limit", "50");
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }
    const response = await authenticatedGet(fetcher, url.toString(), input.headers);
    const page = syncPullResponseSchema.parse(await response.json());
    if (page.kind === "resetRequired") {
      await reconcileSnapshot({ ...input, fetcher, now });
      cursor = await readSyncCursor(input.database, input.householdId);
      resetPerformed = true;
      continue;
    }
    await applyChangePage(input.database, {
      changes: page.changes,
      householdId: input.householdId,
      nextCursor: page.nextCursor,
      now: now().toISOString(),
    });
    appliedChangeCount += page.changes.length;
    cursor = page.nextCursor;
    if (!page.hasMore) {
      break;
    }
  }
  return {
    appliedChangeCount,
    mutationCount: ready.length,
    resetPerformed,
  };
}

async function reconcileSnapshot(input: {
  readonly apiBaseUrl: string;
  readonly database: LocalSyncDatabase;
  readonly fetcher: typeof globalThis.fetch;
  readonly headers?: Readonly<Record<string, string>>;
  readonly householdId: string;
  readonly now: () => Date;
}): Promise<void> {
  let snapshotCursor: string | undefined;
  let capturedCursor: string | undefined;
  while (true) {
    const url = new URL(`${input.apiBaseUrl}/v1/sync/snapshot`);
    url.searchParams.set("limit", "50");
    if (snapshotCursor) {
      url.searchParams.set("cursor", snapshotCursor);
    }
    const response = await authenticatedGet(input.fetcher, url.toString(), input.headers);
    const page = syncSnapshotPageSchema.parse(await response.json());
    if (!capturedCursor) {
      capturedCursor = page.capturedCursor;
      await beginSnapshot(input.database, input.householdId, capturedCursor);
    } else if (capturedCursor !== page.capturedCursor) {
      throw new SyncRunError("validation", "Snapshot pages changed their captured sequence.");
    }
    await stageSnapshotPage(input.database, page.items);
    if (!page.hasMore) {
      await finalizeSnapshot(input.database, {
        capturedCursor,
        householdId: input.householdId,
        now: input.now().toISOString(),
      });
      return;
    }
    if (!page.nextSnapshotCursor) {
      throw new SyncRunError("validation", "The paginated snapshot omitted its next cursor.");
    }
    snapshotCursor = page.nextSnapshotCursor;
  }
}

async function authenticatedGet(
  fetcher: typeof globalThis.fetch,
  url: string,
  headers?: Readonly<Record<string, string>>,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(url, {
      credentials: "include",
      headers: requestHeaders(headers),
    });
  } catch {
    throw new SyncRunError("network", "Synchronization could not reach the server.");
  }
  if (response.status === 401) {
    throw new SyncRunError("authentication", "Synchronization requires authentication.");
  }
  if (response.status >= 500) {
    throw new SyncRunError("server", "Synchronization will retry after a server error.");
  }
  if (!response.ok) {
    throw new SyncRunError("validation", "The synchronization response was rejected.");
  }
  return response;
}

async function retryMutations(
  database: LocalSyncDatabase,
  ready: ReadonlyArray<{ readonly attempts: number }>,
  mutationIds: ReadonlyArray<string>,
  now: () => Date,
  random: () => number,
  errorCode: string,
): Promise<void> {
  const attempt = Math.max(...ready.map((mutation) => mutation.attempts + 1));
  const current = now();
  const nextAttemptAt = new Date(
    current.getTime() + fullJitterRetryDelay({ attempt, randomUnit: random() }),
  ).toISOString();
  await markMutationsRetrying(database, {
    errorCode,
    mutationIds,
    nextAttemptAt,
    now: current.toISOString(),
  });
}

function requestHeaders(
  headers: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
    ...headers,
  };
}
