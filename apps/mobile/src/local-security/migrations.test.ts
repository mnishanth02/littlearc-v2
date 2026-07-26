import { describe, expect, it } from "vitest";
import { applyLocalMigrations, type LocalMigrationDatabase, localMigrations } from "./migrations";

function fakeDatabase(options: { readonly failMigration?: boolean } = {}) {
  const applied = new Set<number>();
  const executed: string[] = [];
  const database: LocalMigrationDatabase = {
    async execAsync(sql) {
      executed.push(sql);
      if (options.failMigration && sql.includes("CREATE TABLE local_enrollment")) {
        throw new Error("synthetic migration failure");
      }
    },
    async getFirstAsync<T>(sql: string, ...params: Array<string | number | null>) {
      if (sql.includes("MAX(version)")) {
        const versions = [...applied];
        return { version: versions.length > 0 ? Math.max(...versions) : 0 } as T;
      }
      const version = Number(params[0]);
      return (applied.has(version) ? { version } : null) as T | null;
    },
    async runAsync(_sql, ...params) {
      applied.add(Number(params[0]));
      return undefined;
    },
    async withTransactionAsync(task) {
      const before = new Set(applied);
      try {
        await task();
      } catch (error) {
        applied.clear();
        for (const version of before) {
          applied.add(version);
        }
        throw error;
      }
    },
  };
  return { applied, database, executed };
}

describe("OFF-03 local migrations", () => {
  it("applies the forward schema once and remains idempotent", async () => {
    const fake = fakeDatabase();
    await expect(applyLocalMigrations(fake.database)).resolves.toBe(8);
    await expect(applyLocalMigrations(fake.database)).resolves.toBe(8);
    expect(fake.applied).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(
      fake.executed.filter((sql) => sql.includes("CREATE TABLE local_enrollment")),
    ).toHaveLength(1);
    expect(localMigrations.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(localMigrations[0]?.sql).toContain("CREATE TABLE local_encrypted_files");
    expect(localMigrations[0]?.sql).not.toContain("database_key");
    expect(localMigrations[0]?.sql).not.toContain("file_key");
    expect(localMigrations[1]?.sql).toContain("CREATE TABLE local_conflicts");
    expect(localMigrations[1]?.sql).toContain("CREATE TABLE local_snapshot_children");
    expect(localMigrations[2]?.sql).toContain("CREATE TABLE local_snapshot_emergency_cards");
    expect(localMigrations[3]?.sql).toContain("CREATE TABLE local_records");
    expect(localMigrations[3]?.sql).toContain("CREATE TABLE local_record_versions");
    expect(localMigrations[3]?.sql).toContain("CREATE TABLE local_timeline_entries");
    expect(localMigrations[4]?.sql).toContain("CREATE TABLE local_record_drafts");
    expect(localMigrations[5]?.sql).toContain("CREATE TABLE local_capture_drafts");
    expect(localMigrations[5]?.sql).toContain("CREATE TABLE local_capture_assets");
    expect(localMigrations[6]?.sql).toContain(
      "ALTER TABLE local_encrypted_files ADD COLUMN wrapped_key",
    );
    expect(localMigrations[7]?.sql).toContain("CREATE TABLE local_upload_sessions");
    expect(localMigrations[7]?.sql).toContain("CREATE TABLE local_upload_parts");
    expect(localMigrations[7]?.sql).not.toContain("signed_url");
  });

  it("does not record a failed migration", async () => {
    const fake = fakeDatabase({ failMigration: true });
    await expect(applyLocalMigrations(fake.database)).rejects.toThrow(
      "synthetic migration failure",
    );
    expect(fake.applied.size).toBe(0);
  });
});
