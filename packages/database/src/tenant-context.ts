import type { HouseholdRole, UuidV7 } from "@littlearc/domain";

export const tenantContextSettings = {
  actorId: "littlearc.current_actor_id",
  actorRole: "littlearc.current_actor_role",
  householdId: "littlearc.current_household_id",
} as const;

export type TenantContext = {
  readonly householdId: UuidV7;
  readonly actorId: UuidV7;
  readonly actorRole: HouseholdRole;
};

export type TenantContextSetting = {
  readonly key: (typeof tenantContextSettings)[keyof typeof tenantContextSettings];
  readonly value: string;
};

export function tenantContextValues(context: TenantContext): ReadonlyArray<TenantContextSetting> {
  return [
    { key: tenantContextSettings.householdId, value: context.householdId },
    { key: tenantContextSettings.actorId, value: context.actorId },
    { key: tenantContextSettings.actorRole, value: context.actorRole },
  ];
}

export function tenantContextSetSql(context: TenantContext): {
  readonly sql: string;
  readonly params: readonly string[];
} {
  return {
    params: tenantContextValues(context).flatMap(({ key, value }) => [key, value]),
    sql: [
      "select set_config($1, $2, true);",
      "select set_config($3, $4, true);",
      "select set_config($5, $6, true);",
    ].join("\n"),
  };
}
