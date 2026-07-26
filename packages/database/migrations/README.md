# Database Migrations

The committed migrations are generated from reviewed, hand-written sources in
`src/migrations/` and registered through `src/migrations/metadata.ts`.

- `0001_fnd_05_database_foundation.sql`: roles, tenant context, RLS, and
  operational primitives.
- `0002_off_01_consumer_auth.sql`: provider-owned consumer identity and session
  storage.
- `0003_off_02_household_consent_audit.sql`: memberships, encrypted profiles,
  consent, key metadata, and strengthened audit evidence.
- `0004_off_05_emergency_card.sql`: dedicated emergency-card aggregate and
  immutable versions.
- `0005_vlt_01_record_foundation.sql`: encrypted record versions, suggestions,
  and Timeline projections.
- `0006_vlt_04_file_upload.sql`: encrypted file objects, tenant-scoped resumable
  upload sessions, and least-authority expired multipart cleanup.

Future migrations created by `drizzle-kit generate` are written to `drizzle/`.
Do not move the FND-05 foundation migration into Drizzle Kit's journal.

Default privileges cover shared app access, operations read access, and sequence
use. Worker table grants remain explicit per migration so the worker cannot gain
access to unrelated future tables.
