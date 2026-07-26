import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

export type DatabaseClient = NodePgDatabase<typeof schema>;

export type DatabaseConnection = {
  readonly database: DatabaseClient;
  readonly close: () => Promise<void>;
};

export function createDatabaseConnection(databaseUrl: string): DatabaseConnection {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
  });

  return {
    close: () => pool.end(),
    database: drizzle(pool, { schema }),
  };
}
