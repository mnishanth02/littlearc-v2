import { localSchemaVersion } from "./policy";

export type LocalMigrationDatabase = {
  readonly execAsync: (sql: string) => Promise<void>;
  readonly getFirstAsync: <T>(
    sql: string,
    ...params: Array<string | number | null>
  ) => Promise<T | null>;
  readonly runAsync: (sql: string, ...params: Array<string | number | null>) => Promise<unknown>;
  readonly withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
};

export type LocalMigration = {
  readonly version: number;
  readonly sql: string;
};

const bootstrapSql = `
  CREATE TABLE IF NOT EXISTS local_schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL
  );
`;

export const localMigrations: ReadonlyArray<LocalMigration> = [
  {
    version: 1,
    sql: `
      CREATE TABLE local_enrollment (
        singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
        device_id TEXT NOT NULL,
        household_id TEXT NOT NULL,
        generation_id TEXT NOT NULL,
        app_lock_policy TEXT NOT NULL CHECK (app_lock_policy = 'strong_biometric'),
        created_at TEXT NOT NULL
      );
      CREATE TABLE local_children (
        child_id TEXT PRIMARY KEY NOT NULL,
        revision INTEGER NOT NULL CHECK (revision > 0),
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE TABLE local_emergency_cards (
        child_id TEXT PRIMARY KEY NOT NULL,
        revision INTEGER NOT NULL CHECK (revision > 0),
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (child_id) REFERENCES local_children(child_id) ON DELETE CASCADE
      );
      CREATE TABLE local_mutations (
        mutation_id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_json TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE local_sync_state (
        household_id TEXT PRIMARY KEY NOT NULL,
        opaque_cursor TEXT,
        last_completed_at TEXT
      );
      CREATE TABLE local_tombstones (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        deleted_at TEXT NOT NULL,
        PRIMARY KEY (entity_type, entity_id)
      );
      CREATE TABLE local_encrypted_files (
        file_id TEXT PRIMARY KEY NOT NULL,
        opaque_name TEXT NOT NULL UNIQUE,
        aad TEXT NOT NULL,
        ciphertext_bytes INTEGER NOT NULL CHECK (ciphertext_bytes > 0),
        created_at TEXT NOT NULL
      );
    `,
  },
] as const;

export async function applyLocalMigrations(database: LocalMigrationDatabase): Promise<number> {
  await database.withTransactionAsync(async () => {
    await database.execAsync(bootstrapSql);
  });
  for (const migration of localMigrations) {
    const existing = await database.getFirstAsync<{ readonly version: number }>(
      "SELECT version FROM local_schema_migrations WHERE version = ?",
      migration.version,
    );
    if (existing) {
      continue;
    }
    await database.withTransactionAsync(async () => {
      await database.execAsync(migration.sql);
      await database.runAsync(
        "INSERT INTO local_schema_migrations (version, applied_at) VALUES (?, ?)",
        migration.version,
        new Date().toISOString(),
      );
    });
  }
  const latest = await database.getFirstAsync<{ readonly version: number }>(
    "SELECT MAX(version) AS version FROM local_schema_migrations",
  );
  if (latest?.version !== localSchemaVersion) {
    throw new Error("The local database schema did not reach the required version.");
  }
  return latest.version;
}
