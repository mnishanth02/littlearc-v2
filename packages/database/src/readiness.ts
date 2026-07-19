import { databaseMigrations } from "./migrations/metadata.js";

const [foundationMigration] = databaseMigrations();
if (!foundationMigration) {
  throw new Error("Expected the FND-05 foundation migration to be registered.");
}

export const databaseFoundationReadiness = {
  connection: "deferred" as const,
  migrationExecution: "explicit-release-step" as const,
  migrationVersion: foundationMigration.version,
  rlsHarness: "policy-source-reviewed" as const,
} as const;

export const databaseReadinessChecks = [
  {
    name: "database",
    owner: "FND-05",
    status: "foundation-ready",
  },
  {
    name: "queue",
    owner: "FND-05",
    status: "outbox-foundation-ready",
  },
] as const;
