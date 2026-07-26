import { PgBoss } from "pg-boss";
import {
  fileValidationDeadLetterQueueName,
  fileValidationQueueDefinition,
  fileValidationQueueName,
} from "./file-validation-queue.js";

const databaseUrl =
  process.env.DATABASE_MIGRATION_URL?.trim() ||
  (process.env.APP_ENV === "local" ? process.env.DATABASE_URL?.trim() : undefined);
if (!databaseUrl) {
  throw new Error("DATABASE_MIGRATION_URL is required to prepare pg-boss.");
}

const boss = new PgBoss({
  connectionString: databaseUrl,
  createSchema: true,
  migrate: true,
  schema: "pgboss",
});

await boss.start();
try {
  await boss.createQueue(fileValidationDeadLetterQueueName, {
    deleteAfterSeconds: fileValidationQueueDefinition.deleteAfterSeconds,
    expireInSeconds: fileValidationQueueDefinition.expireInSeconds,
    policy: "standard",
    retentionSeconds: 14 * 24 * 60 * 60,
    retryLimit: 0,
  });
  await boss.createQueue(fileValidationQueueName, fileValidationQueueDefinition);
  await boss.getDb().executeSql(`
    revoke create on schema pgboss from public, littlearc_worker;
    grant usage on schema pgboss to littlearc_worker;
    grant select, insert, update, delete on all tables in schema pgboss to littlearc_worker;
    grant usage, select, update on all sequences in schema pgboss to littlearc_worker;
    grant execute on all functions in schema pgboss to littlearc_worker;
  `);
  if ((await boss.schemaVersion()) !== 37 || !(await boss.detectSchemaDrift()).ok) {
    throw new Error("Prepared pg-boss schema does not match reviewed version 37.");
  }
  console.log("Prepared pg-boss schema version 37 and VLT-05 queues.");
} finally {
  await boss.stop({ graceful: true, timeout: 30_000 });
}
