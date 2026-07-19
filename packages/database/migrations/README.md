# Database Migrations

`0001_fnd_05_database_foundation.sql` is generated from the reviewed,
hand-written source in `src/migrations/foundation.ts` and registered through
`src/migrations/metadata.ts`.

Future migrations created by `drizzle-kit generate` are written to `drizzle/`.
Do not move the FND-05 foundation migration into Drizzle Kit's journal.

Default privileges cover shared app access, operations read access, and sequence
use. Worker table grants remain explicit per migration so the worker cannot gain
access to unrelated future tables.
