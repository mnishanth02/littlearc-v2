import type { MobileApiClient } from "@littlearc/contracts/client/mobile";

export type MobileContractClient = MobileApiClient;

export const mobileContractBoundary = {
  basePath: "/v1",
  client: "generated-openapi",
  owner: "FND-04",
} as const;
