import { foreignKey, index, text, unique } from "drizzle-orm/pg-core";
import {
  createdAtColumn,
  deletedAtColumn,
  jsonObjectColumn,
  updatedAtColumn,
  uuidV7Column,
} from "./_columns.js";
import { auth_user } from "./auth.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const userProfiles = littlearcSchema.table(
  "user_profiles",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => auth_user.id, { onDelete: "restrict" }),
    membershipId: uuidV7Column("membership_id").notNull(),
    encryptedProfile: jsonObjectColumn("encrypted_profile").notNull(),
    countryCode: text("country_code").notNull(),
    timeZone: text("time_zone").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => [
    unique("user_profiles_user_id_unique").on(table.userId),
    unique("user_profiles_household_id_id_unique").on(table.householdId, table.id),
    index("user_profiles_household_idx").on(table.householdId),
    foreignKey({
      columns: [table.householdId, table.membershipId],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "user_profiles_membership_fk",
    }).onDelete("restrict"),
  ],
);

export type UserProfileRow = typeof userProfiles.$inferSelect;
export type NewUserProfileRow = typeof userProfiles.$inferInsert;
