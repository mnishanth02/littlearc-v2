export const databaseRoles = {
  application: "littlearc_app",
  migration: "littlearc_migration",
  operationsReadOnly: "littlearc_ops_readonly",
  worker: "littlearc_worker",
} as const;

export type DatabaseRoleKind = keyof typeof databaseRoles;
export type DatabaseRoleName = (typeof databaseRoles)[DatabaseRoleKind];

export const orderedDatabaseRoleKinds = [
  "migration",
  "application",
  "worker",
  "operationsReadOnly",
] as const satisfies ReadonlyArray<DatabaseRoleKind>;

export function databaseRoleName(kind: DatabaseRoleKind): DatabaseRoleName {
  return databaseRoles[kind];
}
