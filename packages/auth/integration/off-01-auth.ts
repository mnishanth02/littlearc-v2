import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { createDatabaseConnection } from "../../database/src/index.js";
import { createConsumerAuth } from "../src/index.js";
import type { OtpDeliveryMessage } from "../src/otp-delivery.js";

const migrationPaths = [
  fileURLToPath(
    new URL("../../database/migrations/0001_fnd_05_database_foundation.sql", import.meta.url),
  ),
  fileURLToPath(
    new URL("../../database/migrations/0002_off_01_consumer_auth.sql", import.meta.url),
  ),
];

const databaseRoleNames = [
  "littlearc_migration",
  "littlearc_app",
  "littlearc_worker",
  "littlearc_ops_readonly",
] as const;
const baseUrl = "http://127.0.0.1:3000";
const secret = "off-01-postgres-secret-with-at-least-thirty-two-characters";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function connectionStringForDatabase(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function authRequest(
  handler: (request: Request) => Promise<Response>,
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<Response> {
  const headers = new Headers({
    origin: baseUrl,
    "x-forwarded-for": "192.0.2.201",
  });
  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (cookie) {
    headers.set("cookie", cookie);
  }

  return handler(
    new Request(`${baseUrl}/v1/auth${path}`, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers,
      method: body === undefined ? "GET" : "POST",
    }),
  );
}

function sessionCookie(response: Response): string {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("better-auth.session_token="));
  assert(cookie, "Expected Better Auth to issue a session cookie.");
  return cookie.split(";", 1)[0] ?? cookie;
}

async function runLifecycle(databaseUrl: string, validationClient: Client): Promise<void> {
  const deliveries: OtpDeliveryMessage[] = [];
  const connection = createDatabaseConnection(databaseUrl);
  const auth = createConsumerAuth({
    baseUrl,
    database: connection.database,
    otpDelivery: {
      async send(message) {
        deliveries.push(message);
      },
    },
    secret,
    trustedOrigins: [baseUrl, "littlearc://"],
  });
  const email = "synthetic.off01@example.test";

  const signIn = async (): Promise<{ readonly cookie: string; readonly token: string }> => {
    const sendResponse = await authRequest(auth.handler, "/email-otp/send-verification-otp", {
      email,
      type: "sign-in",
    });
    assert(sendResponse.status === 200, `OTP request returned ${sendResponse.status}.`);
    const delivery = deliveries.at(-1);
    assert(delivery, "The synthetic OTP delivery adapter received no message.");

    const storedVerification = await validationClient.query<{ readonly value: string }>(
      "select value from littlearc.auth_verification where identifier = $1",
      [`sign-in-otp-${email}`],
    );
    assert(storedVerification.rowCount === 1, "Expected one persisted OTP verification value.");
    assert(
      !storedVerification.rows[0]?.value.includes(delivery.otp),
      "The persisted OTP verification value must not contain the delivered code.",
    );

    const response = await authRequest(auth.handler, "/sign-in/email-otp", {
      email,
      otp: delivery.otp,
    });
    assert(response.status === 200, `OTP verification returned ${response.status}.`);
    const body = (await response.json()) as { readonly token?: string };
    assert(body.token, "OTP verification did not return a session token.");
    return { cookie: sessionCookie(response), token: body.token };
  };

  try {
    const first = await signIn();
    const second = await signIn();
    const listResponse = await authRequest(
      auth.handler,
      "/list-sessions",
      undefined,
      second.cookie,
    );
    assert(listResponse.status === 200, `Session listing returned ${listResponse.status}.`);
    const sessions = (await listResponse.json()) as ReadonlyArray<{
      readonly token: string;
    }>;
    assert(
      sessions.some((session) => session.token === first.token) &&
        sessions.some((session) => session.token === second.token),
      "Both PostgreSQL-backed sessions must be listed.",
    );

    const revokeResponse = await authRequest(
      auth.handler,
      "/revoke-session",
      { token: first.token },
      second.cookie,
    );
    assert(revokeResponse.status === 200, `Session revocation returned ${revokeResponse.status}.`);
    const revokedResponse = await authRequest(
      auth.handler,
      "/get-session",
      undefined,
      first.cookie,
    );
    assert((await revokedResponse.json()) === null, "The revoked session remained valid.");

    const counts = await validationClient.query<{
      readonly sessions: string;
      readonly users: string;
    }>(
      `select
         (select count(*)::text from littlearc.auth_user) as users,
         (select count(*)::text from littlearc.auth_session) as sessions`,
    );
    assert(counts.rows[0]?.users === "1", "Expected one persisted synthetic auth user.");
    assert(counts.rows[0]?.sessions === "1", "Expected only the retained session to remain.");
  } finally {
    await connection.close();
  }
}

async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  assert(connectionString, "DATABASE_URL must be loaded from the untracked .env.aiven file.");

  const configuredUrl = new URL(connectionString);
  const sslMode = configuredUrl.searchParams.get("sslmode");
  assert(
    sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full",
    "Aiven OFF-01 validation requires sslmode=require, verify-ca, or verify-full.",
  );
  if (sslMode === "require" && !configuredUrl.searchParams.has("uselibpqcompat")) {
    configuredUrl.searchParams.set("uselibpqcompat", "true");
  }

  const effectiveConnectionString = configuredUrl.toString();
  const temporaryDatabaseName = `littlearc_off01_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const adminClient = new Client({ connectionString: effectiveConnectionString });
  let temporaryClient: Client | undefined;
  let temporaryDatabaseCreated = false;
  let validationError: unknown;
  let serverVersion: string | undefined;
  const rolesExistingBefore = new Set<string>();
  const cleanupErrors: unknown[] = [];
  const attemptCleanup = async (operation: () => Promise<unknown>): Promise<void> => {
    try {
      await operation();
    } catch (error) {
      cleanupErrors.push(error);
    }
  };

  await adminClient.connect();
  try {
    const server = await adminClient.query<{ readonly serverVersion: string }>(
      "select current_setting('server_version') as \"serverVersion\"",
    );
    serverVersion = server.rows[0]?.serverVersion;
    const preexistingRoles = await adminClient.query<{ readonly rolname: string }>(
      "select rolname from pg_roles where rolname = any($1::text[])",
      [databaseRoleNames],
    );
    for (const role of preexistingRoles.rows) {
      rolesExistingBefore.add(role.rolname);
    }

    await adminClient.query(
      `create database ${quoteIdentifier(temporaryDatabaseName)} template template0`,
    );
    temporaryDatabaseCreated = true;
    const temporaryDatabaseUrl = connectionStringForDatabase(
      effectiveConnectionString,
      temporaryDatabaseName,
    );
    temporaryClient = new Client({ connectionString: temporaryDatabaseUrl });
    await temporaryClient.connect();

    for (const migrationPath of migrationPaths) {
      await temporaryClient.query(await readFile(migrationPath, "utf8"));
    }

    const grants = await temporaryClient.query<{
      readonly appCanWrite: boolean;
      readonly opsCanRead: boolean;
      readonly workerCanRead: boolean;
    }>(
      `select
         has_table_privilege('littlearc_app', 'littlearc.auth_user', 'SELECT,INSERT,UPDATE,DELETE') as "appCanWrite",
         has_table_privilege('littlearc_ops_readonly', 'littlearc.auth_user', 'SELECT') as "opsCanRead",
         has_table_privilege('littlearc_worker', 'littlearc.auth_user', 'SELECT') as "workerCanRead"`,
    );
    assert(grants.rows[0]?.appCanWrite, "littlearc_app lacks auth table privileges.");
    assert(!grants.rows[0]?.opsCanRead, "The ops role must not read auth identity rows.");
    assert(!grants.rows[0]?.workerCanRead, "The worker role must not read auth identity rows.");

    await runLifecycle(temporaryDatabaseUrl, temporaryClient);
  } catch (error) {
    validationError = error;
  } finally {
    const clientToClose = temporaryClient;
    if (clientToClose) {
      await attemptCleanup(() => clientToClose.end());
    }
    if (temporaryDatabaseCreated) {
      await attemptCleanup(() =>
        adminClient.query(
          "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
          [temporaryDatabaseName],
        ),
      );
      await attemptCleanup(() =>
        adminClient.query(`drop database if exists ${quoteIdentifier(temporaryDatabaseName)}`),
      );
    }
    for (const roleName of [...databaseRoleNames].reverse()) {
      if (!rolesExistingBefore.has(roleName)) {
        await attemptCleanup(() =>
          adminClient.query(`drop role if exists ${quoteIdentifier(roleName)}`),
        );
      }
    }
    await attemptCleanup(() => adminClient.end());
  }

  if (validationError && cleanupErrors.length > 0) {
    throw new AggregateError(
      [validationError, ...cleanupErrors],
      "Aiven OFF-01 validation and cleanup did not complete.",
    );
  }
  if (validationError) {
    throw validationError;
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Aiven OFF-01 cleanup did not complete.");
  }

  assert(serverVersion, "Could not read the PostgreSQL server version.");
  console.log(`OFF-01 PostgreSQL auth validation passed (PostgreSQL ${serverVersion}).`);
  console.log("- Auth identity, verification, rate-limit, and session tables were created.");
  console.log("- OTP state was not stored in plaintext.");
  console.log("- Two sessions were listed; remote revocation invalidated the selected session.");
  console.log("- Identity-table access remained limited to littlearc_app.");
}

run().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? ` [${String(error.code)}]`
      : "";
  const message = error instanceof Error ? error.message : "Unknown validation failure.";
  const redactedMessage = message.replace(
    /postgres(?:ql)?:\/\/[^\s]+/giu,
    "[redacted-database-url]",
  );
  console.error(`OFF-01 PostgreSQL auth validation failed${code}: ${redactedMessage}`);
  process.exitCode = 1;
});
