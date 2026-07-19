import { z } from "./openapi-zod.js";

export const problemCodeSchema = z
  .enum([
    "bad_request",
    "contract_not_found",
    "forbidden",
    "not_found",
    "record_revision_conflict",
    "request_validation_failed",
    "unauthorized",
    "unknown_error",
  ])
  .describe("Stable application error code");

export const requestIdSchema = z.string().min(1).max(128).describe("Request correlation ID");

export const problemDetailsSchema = z
  .object({
    type: z.string().url(),
    title: z.string().min(1).max(120),
    status: z.number().int().min(400).max(599),
    detail: z.string().min(1).max(500),
    instance: z.string().min(1),
    code: problemCodeSchema,
    requestId: requestIdSchema,
    errors: z
      .array(
        z.object({
          path: z.array(z.union([z.string(), z.number()])),
          message: z.string().min(1).max(240),
        }),
      )
      .default([]),
  })
  .describe("RFC Problem Details with LittleArc error code and request ID");
