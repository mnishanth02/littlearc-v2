import { recordVersionPageSchema } from "@littlearc/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { getMobileEnvironment } from "../bootstrap/environment";
import { withUnlockedLocalDatabase } from "../local-security/native";
import { synchronizationQueryOptions } from "../sync/query";
import { cacheRecordVersions, type RecordVersionProjection } from "../sync/repository";

export type ManualRecordRuntime = {
  readonly headers?: Readonly<Record<string, string>>;
};

export async function synchronizeManualRecords(
  queryClient: QueryClient,
  runtime: ManualRecordRuntime = {},
): Promise<"synced" | "queued"> {
  try {
    await withUnlockedLocalDatabase(async (database) => {
      const enrollment = await database.getFirstAsync<{ readonly householdId: string }>(
        `select household_id as "householdId"
         from local_enrollment where singleton = 1`,
      );
      if (!enrollment) {
        throw new Error("Local enrollment is unavailable.");
      }
      await queryClient.fetchQuery(
        synchronizationQueryOptions({
          apiBaseUrl: getMobileEnvironment().apiBaseUrl,
          database,
          ...(runtime.headers ? { headers: runtime.headers } : {}),
          householdId: enrollment.householdId,
        }),
      );
    });
    return "synced";
  } catch {
    return "queued";
  }
}

export async function refreshRecordHistory(
  recordId: string,
  runtime: ManualRecordRuntime = {},
): Promise<ReadonlyArray<RecordVersionProjection>> {
  const response = await fetch(
    `${getMobileEnvironment().apiBaseUrl}/v1/records/${encodeURIComponent(recordId)}/versions?limit=50`,
    {
      credentials: "include",
      headers: {
        accept: "application/json",
        ...runtime.headers,
      },
    },
  );
  if (!response.ok) {
    throw new Error("Version history could not be refreshed.");
  }
  const page = recordVersionPageSchema.parse(await response.json());
  await withUnlockedLocalDatabase((database) => cacheRecordVersions(database, page.items));
  return page.items;
}
