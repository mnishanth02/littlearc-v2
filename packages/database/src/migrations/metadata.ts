import { createHash } from "node:crypto";
import { foundationMigration, foundationMigrationSql } from "./foundation.js";
import { off01AuthMigration, off01AuthMigrationSql } from "./off-01-auth.js";

const checksumPlaceholder = "__CHECKSUM_SHA256__";

export type DatabaseMigration = {
  readonly version: string;
  readonly filename: string;
  readonly description: string;
  readonly checksumSha256: string;
  readonly sql: string;
};

export function databaseMigrations(): ReadonlyArray<DatabaseMigration> {
  return [
    migrationWithChecksum(foundationMigration, foundationMigrationSql),
    migrationWithChecksum(off01AuthMigration, off01AuthMigrationSql),
  ];
}

function migrationWithChecksum(
  metadata: Omit<DatabaseMigration, "checksumSha256" | "sql">,
  sql: string,
): DatabaseMigration {
  const checksumSha256 = createHash("sha256")
    .update(sql.replace(checksumPlaceholder, ""))
    .digest("hex");

  return {
    ...metadata,
    checksumSha256,
    sql: sql.replace(checksumPlaceholder, checksumSha256),
  };
}
