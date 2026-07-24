export const contractVersion = "0.1.0";
export const apiBasePath = "/v1";
export const generatedAt = "2026-07-19T00:00:00.000Z";

export const resourceGroups = [
  { prefix: "/v1/auth", owner: "OFF-01", status: "reserved" },
  { prefix: "/v1/households", owner: "OFF-02", status: "reserved" },
  { prefix: "/v1/children", owner: "OFF-02", status: "reserved" },
  { prefix: "/v1/devices", owner: "OFF-03", status: "active" },
  { prefix: "/v1/emergency-cards", owner: "OFF-05", status: "active" },
  { prefix: "/v1/records", owner: "VLT-01", status: "active" },
  { prefix: "/v1/files", owner: "M3", status: "reserved" },
  { prefix: "/v1/timeline", owner: "M3", status: "reserved" },
  { prefix: "/v1/reminders", owner: "M4", status: "reserved" },
  { prefix: "/v1/tasks", owner: "M4", status: "reserved" },
  { prefix: "/v1/memories", owner: "M4", status: "reserved" },
  { prefix: "/v1/consents", owner: "OFF-02", status: "reserved" },
  { prefix: "/v1/ai-extractions", owner: "M3", status: "reserved" },
  { prefix: "/v1/sync", owner: "OFF-04", status: "reserved" },
  { prefix: "/v1/exports", owner: "M5", status: "reserved" },
  { prefix: "/v1/deletion-requests", owner: "M5", status: "reserved" },
  { prefix: "/v1/entitlements", owner: "M5", status: "reserved" },
  { prefix: "/v1/staff", owner: "M5", status: "reserved" },
] as const;

export const contractMetadata = {
  name: "littlearc-api",
  version: contractVersion,
  basePath: apiBasePath,
  generatedAt,
  resourceGroups,
} as const;
