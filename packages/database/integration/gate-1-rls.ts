import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client, type QueryResult } from "pg";

const migrationPath = fileURLToPath(
  new URL("../migrations/0001_fnd_05_database_foundation.sql", import.meta.url),
);

const databaseRoleNames = [
  "littlearc_migration",
  "littlearc_app",
  "littlearc_worker",
  "littlearc_ops_readonly",
] as const;

const fixtures = {
  actorA: "01910000-0000-7000-8000-000000000101",
  actorB: "01910000-0000-7000-8000-000000000102",
  childA: "01910000-0000-7000-8000-000000000201",
  childB: "01910000-0000-7000-8000-000000000202",
  householdA: "01910000-0000-7000-8000-000000000001",
  householdB: "01910000-0000-7000-8000-000000000002",
} as const;

type RoleAttributes = {
  readonly rolbypassrls: boolean;
  readonly rolcanlogin: boolean;
  readonly rolinherit: boolean;
  readonly rolname: string;
  readonly rolsuper: boolean;
};

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

async function setLocalTenantContext(
  client: Client,
  householdId: string,
  actorId: string,
): Promise<void> {
  await client.query(
    `select
       set_config('littlearc.current_household_id', $1, true),
       set_config('littlearc.current_actor_id', $2, true),
       set_config('littlearc.current_actor_role', 'owner', true)`,
    [householdId, actorId],
  );
}

async function seedHousehold(
  client: Client,
  householdId: string,
  actorId: string,
  childId: string,
  fixtureLabel: string,
): Promise<void> {
  await client.query("begin");
  try {
    await setLocalTenantContext(client, householdId, actorId);
    await client.query(
      `insert into littlearc.households (
         id, default_country_code, created_by, updated_by
       ) values ($1, 'IN', $2, $2)`,
      [householdId, actorId],
    );
    await client.query(
      `insert into littlearc.children (
         id,
         household_id,
         encrypted_profile,
         access_policy,
         created_by,
         updated_by
       ) values ($1, $2, $3::jsonb, $4::jsonb, $5, $5)`,
      [
        childId,
        householdId,
        JSON.stringify({ ciphertext: `synthetic-${fixtureLabel}` }),
        JSON.stringify({ mode: "synthetic-test" }),
        actorId,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

function assertSingleIdentifier(
  result: QueryResult<{ readonly id: string }>,
  expectedId: string,
  message: string,
): void {
  assert(result.rowCount === 1, `${message}: expected one row, received ${result.rowCount ?? 0}.`);
  assert(result.rows[0]?.id === expectedId, `${message}: returned an unexpected identifier.`);
}

async function verifyApplicationRole(client: Client): Promise<void> {
  const roleResult = await client.query<RoleAttributes>(
    `select rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit
       from pg_roles
      where rolname = 'littlearc_app'`,
  );
  const role = roleResult.rows[0];

  assert(role !== undefined, "The littlearc_app role was not created by the migration.");
  assert(!role.rolsuper, "The littlearc_app role must not be a superuser.");
  assert(!role.rolbypassrls, "The littlearc_app role must not bypass RLS.");
  assert(!role.rolcanlogin, "The littlearc_app foundation role must remain a group role.");
  assert(!role.rolinherit, "The littlearc_app foundation role must remain NOINHERIT.");
}

async function verifyNoContextIsClosed(client: Client): Promise<void> {
  await client.query("begin");
  try {
    await client.query("set local role littlearc_app");
    const result = await client.query<{ readonly count: string }>(
      "select count(*)::text as count from littlearc.children",
    );
    assert(result.rows[0]?.count === "0", "No-context application reads must return zero rows.");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function verifyHouseholdAIsolation(client: Client): Promise<void> {
  await client.query("begin");
  try {
    await client.query("set local role littlearc_app");
    await setLocalTenantContext(client, fixtures.householdA, fixtures.actorA);

    const executionRole = await client.query<{ readonly currentRole: string }>(
      'select current_user as "currentRole"',
    );
    assert(
      executionRole.rows[0]?.currentRole === "littlearc_app",
      "Isolation assertions must execute as littlearc_app.",
    );

    const visibleChildren = await client.query<{ readonly id: string }>(
      "select id::text from littlearc.children order by id",
    );
    assertSingleIdentifier(
      visibleChildren,
      fixtures.childA,
      "Household A must see only its own seeded child",
    );

    const ownChild = await client.query<{ readonly id: string }>(
      "select id::text from littlearc.children where id = $1",
      [fixtures.childA],
    );
    assertSingleIdentifier(ownChild, fixtures.childA, "Household A must see Child A");

    const crossHouseholdChild = await client.query<{ readonly id: string }>(
      "select id::text from littlearc.children where id = $1",
      [fixtures.childB],
    );
    assert(
      crossHouseholdChild.rowCount === 0,
      "Household A must not read Child B by exact identifier.",
    );

    const crossHousehold = await client.query<{ readonly id: string }>(
      "select id::text from littlearc.households where id = $1",
      [fixtures.householdB],
    );
    assert(crossHousehold.rowCount === 0, "Household A must not read Household B.");

    const crossHouseholdUpdate = await client.query(
      "update littlearc.children set updated_at = now() where id = $1",
      [fixtures.childB],
    );
    assert(crossHouseholdUpdate.rowCount === 0, "Household A must not update Child B.");

    await client.query("savepoint cross_household_insert");
    let rejectedInsertCode: string | undefined;
    try {
      await client.query(
        `insert into littlearc.children (
           id,
           household_id,
           encrypted_profile,
           access_policy,
           created_by,
           updated_by
         ) values ($1, $2, '{}'::jsonb, '{}'::jsonb, $3, $3)`,
        ["01910000-0000-7000-8000-000000000299", fixtures.householdB, fixtures.actorA],
      );
    } catch (error) {
      rejectedInsertCode =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : undefined;
      await client.query("rollback to savepoint cross_household_insert");
    }
    assert(
      rejectedInsertCode === "42501",
      `Cross-household insert must fail with SQLSTATE 42501; received ${rejectedInsertCode ?? "no error"}.`,
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function verifyHouseholdBSeed(client: Client): Promise<void> {
  await client.query("begin");
  try {
    await client.query("set local role littlearc_app");
    await setLocalTenantContext(client, fixtures.householdB, fixtures.actorB);
    const result = await client.query<{ readonly id: string }>(
      "select id::text from littlearc.children order by id",
    );
    assertSingleIdentifier(
      result,
      fixtures.childB,
      "Household B must see only its own seeded child",
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  assert(connectionString, "DATABASE_URL must be loaded from the untracked .env.aiven file.");

  const configuredUrl = new URL(connectionString);
  const sslMode = configuredUrl.searchParams.get("sslmode");
  assert(
    sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full",
    "Aiven Gate 1 validation requires sslmode=require, verify-ca, or verify-full.",
  );

  if (sslMode === "require" && !configuredUrl.searchParams.has("uselibpqcompat")) {
    configuredUrl.searchParams.set("uselibpqcompat", "true");
  }

  const effectiveConnectionString = configuredUrl.toString();

  const baseDatabaseName = decodeURIComponent(configuredUrl.pathname.slice(1));
  assert(baseDatabaseName, "DATABASE_URL must include an administrative database name.");

  const temporaryDatabaseName = `littlearc_gate1_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const adminClient = new Client({ connectionString: effectiveConnectionString });
  let temporaryClient: Client | undefined;
  let temporaryDatabaseCreated = false;
  let membershipGranted = false;
  let serverVersion: string | undefined;
  let validationError: unknown;
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
    const serverResult = await adminClient.query<{
      readonly currentUser: string;
      readonly serverVersion: string;
    }>(
      'select current_user as "currentUser", current_setting(\'server_version\') as "serverVersion"',
    );
    const server = serverResult.rows[0];
    assert(server, "Could not read PostgreSQL server metadata.");
    serverVersion = server.serverVersion;

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

    temporaryClient = new Client({
      connectionString: connectionStringForDatabase(
        effectiveConnectionString,
        temporaryDatabaseName,
      ),
    });
    await temporaryClient.connect();

    const migrationSql = await readFile(migrationPath, "utf8");
    await temporaryClient.query(migrationSql);
    await verifyApplicationRole(temporaryClient);

    const membershipResult = await adminClient.query<{ readonly isMember: boolean }>(
      "select pg_has_role(current_user, 'littlearc_app', 'MEMBER') as \"isMember\"",
    );
    if (!membershipResult.rows[0]?.isMember) {
      await adminClient.query(
        `grant ${quoteIdentifier("littlearc_app")} to ${quoteIdentifier(server.currentUser)}`,
      );
      membershipGranted = true;
    }

    await seedHousehold(
      temporaryClient,
      fixtures.householdA,
      fixtures.actorA,
      fixtures.childA,
      "household-a",
    );
    await seedHousehold(
      temporaryClient,
      fixtures.householdB,
      fixtures.actorB,
      fixtures.childB,
      "household-b",
    );

    await verifyNoContextIsClosed(temporaryClient);
    await verifyHouseholdAIsolation(temporaryClient);
    await verifyHouseholdBSeed(temporaryClient);
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

    if (membershipGranted) {
      await attemptCleanup(async () => {
        const currentUserResult = await adminClient.query<{ readonly currentUser: string }>(
          'select current_user as "currentUser"',
        );
        const currentUser = currentUserResult.rows[0]?.currentUser;
        if (currentUser) {
          await adminClient.query(
            `revoke ${quoteIdentifier("littlearc_app")} from ${quoteIdentifier(currentUser)}`,
          );
        }
      });
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
      "Aiven Gate 1 validation and cleanup did not complete.",
    );
  }
  if (validationError) {
    throw validationError;
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Aiven Gate 1 cleanup did not complete.");
  }

  assert(serverVersion, "Could not retain PostgreSQL server metadata.");
  console.log(`Gate 1 Aiven PostgreSQL RLS validation passed (PostgreSQL ${serverVersion}).`);
  console.log("- littlearc_app is NOLOGIN, NOINHERIT, non-superuser, and cannot bypass RLS.");
  console.log("- No-context application reads returned zero tenant rows.");
  console.log("- Household A saw only Child A; Household B and Child B were invisible.");
  console.log("- Household A could not update Child B.");
  console.log("- Household A cross-household insert was rejected with SQLSTATE 42501.");
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
  console.error(`Gate 1 Aiven PostgreSQL RLS validation failed${code}: ${redactedMessage}`);
  process.exitCode = 1;
});
