import { defineConfig } from "drizzle-kit";

const drizzleKitMigrationOutput = "./migrations/drizzle";
const localAdminDatabaseUrl = "postgres://postgres:postgres@localhost:5432/littlearc";

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? localAdminDatabaseUrl,
  },
  out: drizzleKitMigrationOutput,
  schema: "./src/schema/index.ts",
  strict: true,
  verbose: true,
});
