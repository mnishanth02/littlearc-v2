import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? "postgres://littlearc_migration:unused@localhost:5432/littlearc",
  },
  out: "./migrations/drizzle",
  schema: "./src/schema/index.ts",
  strict: true,
  verbose: true,
});
