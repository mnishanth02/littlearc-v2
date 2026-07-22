import type { HouseholdRole, UuidV7 } from "@littlearc/domain";

export const tenantContextSettings = {
  actorId: "littlearc.current_actor_id",
  actorRole: "littlearc.current_actor_role",
  householdId: "littlearc.current_household_id",
  identityUserId: "littlearc.current_identity_user_id",
} as const;

export type TenantContext = {
  readonly householdId: UuidV7;
  readonly actorId: UuidV7;
  readonly actorRole: HouseholdRole;
  readonly identityUserId: string;
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
    { key: tenantContextSettings.identityUserId, value: context.identityUserId },
  ];
}

export function tenantContextSetSql(context: TenantContext): {
  readonly sql: string;
  readonly params: readonly string[];
} {
  const values = tenantContextValues(context);

  return {
    params: values.flatMap(({ key, value }) => [key, value]),
    sql: values
      .map((_, index) => `select set_config($${index * 2 + 1}, $${index * 2 + 2}, true);`)
      .join("\n"),
  };
}
