import { createHash } from "node:crypto";
import { foundationMigration, foundationMigrationSql } from "./foundation.js";
import { off01AuthMigration, off01AuthMigrationSql } from "./off-01-auth.js";
import { off02HouseholdMigration, off02HouseholdMigrationSql } from "./off-02-household.js";
import {
  off05EmergencyCardMigration,
  off05EmergencyCardMigrationSql,
} from "./off-05-emergency-card.js";
import {
  vlt01RecordFoundationMigration,
  vlt01RecordFoundationMigrationSql,
} from "./vlt-01-record-foundation.js";
import { vlt04FileUploadMigration, vlt04FileUploadMigrationSql } from "./vlt-04-file-upload.js";

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
    migrationWithChecksum(off02HouseholdMigration, off02HouseholdMigrationSql),
    migrationWithChecksum(off05EmergencyCardMigration, off05EmergencyCardMigrationSql),
    migrationWithChecksum(vlt01RecordFoundationMigration, vlt01RecordFoundationMigrationSql),
    migrationWithChecksum(vlt04FileUploadMigration, vlt04FileUploadMigrationSql),
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
