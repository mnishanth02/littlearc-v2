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
  {
    version: 2,
    sql: `
      ALTER TABLE local_children ADD COLUMN server_payload_json TEXT;
      ALTER TABLE local_children ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'synced';
      ALTER TABLE local_mutations ADD COLUMN base_revision INTEGER;
      ALTER TABLE local_mutations ADD COLUMN idempotency_key TEXT;
      ALTER TABLE local_mutations ADD COLUMN dependency_ids_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE local_mutations ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE local_mutations ADD COLUMN next_attempt_at TEXT;
      ALTER TABLE local_mutations ADD COLUMN last_error_code TEXT;
      ALTER TABLE local_mutations ADD COLUMN updated_at TEXT;
      ALTER TABLE local_sync_state ADD COLUMN reset_status TEXT NOT NULL DEFAULT 'idle';
      ALTER TABLE local_sync_state ADD COLUMN captured_cursor TEXT;
      CREATE TABLE local_conflicts (
        conflict_id TEXT PRIMARY KEY NOT NULL,
        mutation_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        local_payload_json TEXT,
        server_payload_json TEXT,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (mutation_id) REFERENCES local_mutations(mutation_id)
      );
      CREATE TABLE local_snapshot_children (
        child_id TEXT PRIMARY KEY NOT NULL,
        revision INTEGER NOT NULL CHECK (revision > 0),
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX local_mutations_dispatch_idx
        ON local_mutations(status, next_attempt_at, created_at);
      CREATE INDEX local_conflicts_entity_idx
        ON local_conflicts(entity_type, entity_id, created_at);
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE local_emergency_cards ADD COLUMN card_id TEXT;
      ALTER TABLE local_emergency_cards ADD COLUMN child_id_snapshot TEXT;
      ALTER TABLE local_emergency_cards ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE local_emergency_cards ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'standard';
      ALTER TABLE local_emergency_cards ADD COLUMN server_payload_json TEXT;
      ALTER TABLE local_emergency_cards ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'synced';
      ALTER TABLE local_emergency_cards ADD COLUMN deleted_at TEXT;
      CREATE UNIQUE INDEX local_emergency_cards_card_id_idx
        ON local_emergency_cards(card_id);
      CREATE TABLE local_snapshot_emergency_cards (
        card_id TEXT PRIMARY KEY NOT NULL,
        child_id TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision > 0),
        version INTEGER NOT NULL CHECK (version > 0),
        access_mode TEXT NOT NULL CHECK (access_mode = 'standard'),
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE local_records (
        record_id TEXT PRIMARY KEY NOT NULL,
        child_id TEXT NOT NULL,
        category TEXT NOT NULL,
        source_type TEXT NOT NULL,
        confirmation_state TEXT NOT NULL,
        event_at TEXT,
        access_scope TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision > 0),
        version INTEGER NOT NULL CHECK (version > 0),
        version_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        server_payload_json TEXT,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        sync_status TEXT NOT NULL,
        FOREIGN KEY (child_id) REFERENCES local_children(child_id) ON DELETE CASCADE
      );
      CREATE TABLE local_record_versions (
        version_id TEXT PRIMARY KEY NOT NULL,
        record_id TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version > 0),
        payload_json TEXT NOT NULL,
        provenance_json TEXT NOT NULL,
        confirmed_at TEXT,
        created_at TEXT NOT NULL,
        supersedes_version_id TEXT,
        UNIQUE (record_id, version),
        FOREIGN KEY (record_id) REFERENCES local_records(record_id) ON DELETE CASCADE
      );
      CREATE TABLE local_timeline_entries (
        entry_id TEXT PRIMARY KEY NOT NULL,
        child_id TEXT NOT NULL,
        record_id TEXT NOT NULL,
        source_version_id TEXT NOT NULL,
        event_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision > 0),
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (record_id) REFERENCES local_records(record_id) ON DELETE CASCADE
      );
      CREATE TABLE local_snapshot_records (
        record_id TEXT PRIMARY KEY NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE local_snapshot_timeline_entries (
        entry_id TEXT PRIMARY KEY NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX local_records_child_event_idx
        ON local_records(child_id, event_at DESC, record_id DESC);
      CREATE INDEX local_record_versions_record_version_idx
        ON local_record_versions(record_id, version DESC);
      CREATE INDEX local_timeline_child_event_idx
        ON local_timeline_entries(child_id, event_at DESC, entry_id DESC);
    `,
  },
  {
    version: 5,
    sql: `
      CREATE TABLE local_record_drafts (
        draft_id TEXT PRIMARY KEY NOT NULL,
        target_record_id TEXT,
        child_id TEXT NOT NULL,
        category TEXT NOT NULL,
        form_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (child_id) REFERENCES local_children(child_id) ON DELETE CASCADE
      );
      CREATE INDEX local_record_drafts_child_updated_idx
        ON local_record_drafts(child_id, updated_at DESC, draft_id DESC);
    `,
  },
  {
    version: 6,
    sql: `
      CREATE TABLE local_capture_drafts (
        draft_id TEXT PRIMARY KEY NOT NULL,
        child_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('editing', 'processing')),
        safe_error_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (child_id) REFERENCES local_children(child_id) ON DELETE CASCADE
      );
      CREATE TABLE local_capture_assets (
        asset_id TEXT PRIMARY KEY NOT NULL,
        draft_id TEXT NOT NULL,
        source_kind TEXT NOT NULL CHECK (
          source_kind IN ('scanner', 'camera', 'gallery', 'file', 'share')
        ),
        display_order INTEGER NOT NULL CHECK (display_order >= 0),
        detected_mime TEXT NOT NULL CHECK (
          detected_mime IN ('image/jpeg', 'image/png', 'image/heic', 'application/pdf')
        ),
        original_bytes INTEGER NOT NULL CHECK (original_bytes > 0),
        page_count INTEGER NOT NULL CHECK (page_count > 0 AND page_count <= 50),
        width INTEGER,
        height INTEGER,
        original_file_id TEXT NOT NULL UNIQUE,
        normalized_file_id TEXT UNIQUE,
        thumbnail_file_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        UNIQUE (draft_id, display_order),
        FOREIGN KEY (draft_id) REFERENCES local_capture_drafts(draft_id) ON DELETE CASCADE,
        FOREIGN KEY (original_file_id) REFERENCES local_encrypted_files(file_id),
        FOREIGN KEY (normalized_file_id) REFERENCES local_encrypted_files(file_id),
        FOREIGN KEY (thumbnail_file_id) REFERENCES local_encrypted_files(file_id)
      );
      CREATE INDEX local_capture_drafts_child_updated_idx
        ON local_capture_drafts(child_id, updated_at DESC, draft_id DESC);
      CREATE INDEX local_capture_assets_draft_order_idx
        ON local_capture_assets(draft_id, display_order, asset_id);
    `,
  },
  {
    version: 7,
    sql: `
      ALTER TABLE local_encrypted_files ADD COLUMN wrapped_key TEXT;
    `,
  },
  {
    version: 8,
    sql: `
      ALTER TABLE local_encrypted_files ADD COLUMN file_object_id TEXT;
      ALTER TABLE local_encrypted_files ADD COLUMN aad_version INTEGER;
      ALTER TABLE local_encrypted_files ADD COLUMN content_nonce TEXT;
      ALTER TABLE local_encrypted_files ADD COLUMN auth_tag TEXT;
      ALTER TABLE local_encrypted_files ADD COLUMN ciphertext_sha256 TEXT;
      ALTER TABLE local_encrypted_files ADD COLUMN transport_ready INTEGER NOT NULL DEFAULT 0;
      CREATE UNIQUE INDEX local_encrypted_files_file_object_idx
        ON local_encrypted_files(file_object_id)
        WHERE file_object_id IS NOT NULL;
      CREATE TABLE local_upload_sessions (
        session_id TEXT PRIMARY KEY NOT NULL,
        file_object_id TEXT NOT NULL UNIQUE,
        capture_asset_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        local_file_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK (
          state IN ('created', 'uploading', 'completing', 'uploaded', 'cancelled', 'expired', 'failed')
        ),
        safe_error_code TEXT,
        expected_ciphertext_bytes INTEGER NOT NULL CHECK (expected_ciphertext_bytes > 0),
        expected_ciphertext_sha256 TEXT NOT NULL,
        expires_at TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (capture_asset_id) REFERENCES local_capture_assets(asset_id) ON DELETE CASCADE,
        FOREIGN KEY (child_id) REFERENCES local_children(child_id) ON DELETE CASCADE,
        FOREIGN KEY (local_file_id) REFERENCES local_encrypted_files(file_id) ON DELETE CASCADE
      );
      CREATE TABLE local_upload_parts (
        session_id TEXT NOT NULL,
        part_number INTEGER NOT NULL CHECK (part_number > 0),
        etag TEXT NOT NULL,
        byte_count INTEGER NOT NULL CHECK (byte_count > 0),
        uploaded_at TEXT NOT NULL,
        PRIMARY KEY (session_id, part_number),
        FOREIGN KEY (session_id) REFERENCES local_upload_sessions(session_id) ON DELETE CASCADE
      );
      CREATE INDEX local_upload_sessions_state_updated_idx
        ON local_upload_sessions(state, updated_at);
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
