import { createHash } from "node:crypto";
import { foundationMigration, foundationMigrationSql } from "./foundation.js";

const checksumPlaceholder = "__CHECKSUM_SHA256__";

export type DatabaseMigration = {
  readonly version: string;
  readonly filename: string;
  readonly description: string;
  readonly checksumSha256: string;
  readonly sql: string;
};

export function databaseMigrations(): ReadonlyArray<DatabaseMigration> {
  const checksumSha256 = createHash("sha256")
    .update(foundationMigrationSql.replace(checksumPlaceholder, ""))
    .digest("hex");

  return [
    {
      checksumSha256,
      description: foundationMigration.description,
      filename: foundationMigration.filename,
      sql: foundationMigrationSql.replace(checksumPlaceholder, checksumSha256),
      version: foundationMigration.version,
    },
  ];
}
