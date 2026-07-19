import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { databaseMigrations } from "./metadata.js";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));

for (const migration of databaseMigrations()) {
  const outputPath = join(packageRoot, "migrations", migration.filename);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${migration.sql}\n`, "utf8");
}

console.log(`Generated ${databaseMigrations().length} database migration artifact(s).`);
