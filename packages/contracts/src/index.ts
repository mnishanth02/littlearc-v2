export { createMobileApiClient, type MobileApiClient } from "./client/mobile.js";
export { createStaffApiClient, type StaffApiClient } from "./client/staff.js";
export { openApiDocument } from "./generated/openapi-document.js";
export type { paths } from "./generated/openapi-types.js";
export { detectBreakingContractChanges } from "./openapi/compatibility.js";
export {
  apiBasePath,
  contractMetadata,
  contractVersion,
  resourceGroups,
} from "./openapi/resource-groups.js";
export * from "./schema-source/index.js";
