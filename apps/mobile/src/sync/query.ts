import { queryOptions } from "@tanstack/react-query";
import { runSynchronization } from "./engine";

export function synchronizationQueryOptions(input: Parameters<typeof runSynchronization>[0]) {
  return queryOptions({
    gcTime: 5 * 60_000,
    queryFn: () => runSynchronization(input),
    queryKey: ["sync-run-status", input.householdId],
    retry: false,
    staleTime: 0,
  });
}
