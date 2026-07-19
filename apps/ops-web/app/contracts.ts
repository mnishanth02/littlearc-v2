import type { StaffApiClient } from "@littlearc/contracts/client/staff";

export type StaffContractClient = StaffApiClient;

export const staffContractBoundary = {
  basePath: "/v1",
  client: "generated-openapi",
  owner: "FND-04",
} as const;
