import {
  cursorPattern,
  householdCapabilities,
  householdRoles,
  utcTimestampPattern,
  uuidV7Pattern,
} from "@littlearc/domain";
import { z } from "./openapi-zod.js";

export const uuidV7Schema = z
  .string()
  .regex(new RegExp(uuidV7Pattern, "i"))
  .describe("UUIDv7 identifier");

export const utcTimestampSchema = z
  .string()
  .regex(new RegExp(utcTimestampPattern))
  .describe("Normalized UTC ISO 8601 timestamp");

export const revisionSchema = z
  .number()
  .int()
  .positive()
  .safe()
  .describe("Mutable entity revision");

export const cursorSchema = z
  .string()
  .regex(new RegExp(cursorPattern))
  .describe("Opaque pagination or synchronization cursor");

export const idempotencyKeySchema = uuidV7Schema.describe(
  "Client-generated UUIDv7 idempotency key",
);

export const householdRoleSchema = z.enum(householdRoles);
export const householdCapabilitySchema = z.enum(householdCapabilities);
