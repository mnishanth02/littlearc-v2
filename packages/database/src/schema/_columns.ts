import type { Revision, UuidV7 } from "@littlearc/domain";
import { customType, integer, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";

export type JsonObject = Record<string, unknown>;

export const uuidV7Column = (name: string) => uuid(name).$type<UuidV7>();

export const revisionColumn = (name = "revision") => integer(name).$type<Revision>().notNull();

export const createdAtColumn = () =>
  timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow();

export const updatedAtColumn = () =>
  timestamp("updated_at", { mode: "string", withTimezone: true }).notNull().defaultNow();

export const deletedAtColumn = () =>
  timestamp("deleted_at", {
    mode: "string",
    withTimezone: true,
  });

export const jsonObjectColumn = (name: string) => jsonb(name).$type<JsonObject>();

export const byteaColumn = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});
