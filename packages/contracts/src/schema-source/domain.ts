import {
  auditActions,
  confirmationStates,
  consentPurposes,
  consentStates,
  recordCategories,
  recordSourceTypes,
} from "@littlearc/domain";
import { z } from "./openapi-zod.js";
import {
  cursorSchema,
  householdCapabilitySchema,
  householdRoleSchema,
  revisionSchema,
  utcTimestampSchema,
  uuidV7Schema,
} from "./primitives.js";

export const resourceGroupStatusSchema = z.enum(["active", "reserved"]);

export const resourceGroupSchema = z.object({
  prefix: z.string().startsWith("/v1/"),
  owner: z.string().min(1),
  status: resourceGroupStatusSchema,
});

export const contractMetadataSchema = z.object({
  name: z.literal("littlearc-api"),
  version: z.string().min(1),
  basePath: z.literal("/v1"),
  generatedAt: utcTimestampSchema,
  resourceGroups: z.array(resourceGroupSchema),
});

export const paginatedResponseSchema = z.object({
  items: z.array(z.unknown()),
  nextCursor: cursorSchema.nullable(),
});

export const householdIdentifierSchema = z.object({
  householdId: uuidV7Schema,
});

export const childIdentifierSchema = householdIdentifierSchema.extend({
  childId: uuidV7Schema,
});

export const actorIdentifierSchema = householdIdentifierSchema.extend({
  actorId: uuidV7Schema,
  role: householdRoleSchema,
});

export const accessPolicySchema = z.object({
  role: householdRoleSchema,
  capabilities: z.array(householdCapabilitySchema),
});

export const ownerOnboardingRequestSchema = z.object({
  adultVerificationAssertion: z.string().min(16).max(512),
  child: z.object({
    dateOfBirth: z.string().date(),
    preferredName: z.string().trim().min(1).max(120),
  }),
  childDataConsentVersion: z.literal("child-data-processing-v1"),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  parent: z.object({
    displayName: z.string().trim().min(1).max(120),
    relationship: z.string().trim().min(1).max(80),
  }),
  parentNoticeVersion: z.literal("parent-notice-v1"),
  timeZone: z.string().trim().min(1).max(80),
});

export const ownerOnboardingResponseSchema = z.object({
  childDataConsentId: uuidV7Schema,
  childId: uuidV7Schema,
  householdId: uuidV7Schema,
  membershipId: uuidV7Schema,
  parentNoticeConsentId: uuidV7Schema,
  parentProfileId: uuidV7Schema,
  replayed: z.boolean(),
});

export const deviceEnrollmentRequestSchema = z.object({
  appVersion: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/),
  deviceId: uuidV7Schema,
  localSchemaVersion: z.union([z.literal(1), z.literal(2)]),
  platform: z.enum(["android", "ios"]),
});

export const deviceEnrollmentResponseSchema = z.object({
  deviceId: uuidV7Schema,
  enrollmentStatus: z.literal("active"),
  householdId: uuidV7Schema,
  localSchemaVersion: z.union([z.literal(1), z.literal(2)]),
  replayed: z.boolean(),
});

export const mutableResourceSchema = z.object({
  id: uuidV7Schema,
  householdId: uuidV7Schema,
  revision: revisionSchema,
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  deletedAt: utcTimestampSchema.nullable(),
});

export const consentPurposeSchema = z.enum(consentPurposes);
export const consentStateSchema = z.enum(consentStates);

export const consentEventSchema = mutableResourceSchema.extend({
  actorId: uuidV7Schema,
  childId: uuidV7Schema.nullable(),
  purpose: consentPurposeSchema,
  state: consentStateSchema,
  noticeVersion: z.string().min(1),
});

export const auditActionSchema = z.enum(auditActions);

export const auditEventSchema = z.object({
  id: uuidV7Schema,
  householdId: uuidV7Schema,
  actorId: uuidV7Schema,
  action: auditActionSchema,
  targetType: z.string().min(1),
  targetId: uuidV7Schema,
  requestId: uuidV7Schema,
  occurredAt: utcTimestampSchema,
  purposeCode: z.string().min(1).max(80).nullable(),
});

export const recordCategorySchema = z.enum(recordCategories);
export const recordSourceTypeSchema = z.enum(recordSourceTypes);
export const confirmationStateSchema = z.enum(confirmationStates);

export const recordDescriptorSchema = mutableResourceSchema.extend({
  childId: uuidV7Schema,
  category: recordCategorySchema,
  sourceType: recordSourceTypeSchema,
  confirmationState: confirmationStateSchema,
  accessPolicy: accessPolicySchema,
});

export const syncMutationSchema = z.object({
  mutationId: uuidV7Schema,
  entityType: z.enum(["child", "consent", "record", "emergencyCard"]),
  entityId: uuidV7Schema,
  operation: z.enum(["create", "update", "delete"]),
  baseRevision: revisionSchema.nullable(),
  localDependencyIds: z.array(uuidV7Schema),
});

export const childProfileProjectionSchema = z.object({
  childId: uuidV7Schema,
  dateOfBirth: z.string().date(),
  preferredName: z.string().trim().min(1).max(120),
  revision: revisionSchema,
  updatedAt: utcTimestampSchema,
});

export const syncChangeSchema = z.discriminatedUnion("operation", [
  z.object({
    changedAt: utcTimestampSchema,
    entity: childProfileProjectionSchema,
    entityId: uuidV7Schema,
    entityType: z.literal("child"),
    operation: z.literal("upsert"),
    revision: revisionSchema,
    sequence: z.number().int().positive(),
  }),
  z.object({
    changedAt: utcTimestampSchema,
    entityId: uuidV7Schema,
    entityType: z.literal("child"),
    operation: z.literal("delete"),
    revision: revisionSchema,
    sequence: z.number().int().positive(),
  }),
]);

export const syncChangesPageSchema = z.object({
  changes: z.array(syncChangeSchema),
  hasMore: z.boolean(),
  kind: z.literal("changes"),
  nextCursor: cursorSchema,
  serverTime: utcTimestampSchema,
});

export const syncResetRequiredSchema = z.object({
  kind: z.literal("resetRequired"),
  reason: z.enum(["initialSync", "cursorExpired"]),
  serverTime: utcTimestampSchema,
});

export const syncPullResponseSchema = z.discriminatedUnion("kind", [
  syncChangesPageSchema,
  syncResetRequiredSchema,
]);

export const syncSnapshotPageSchema = z.object({
  capturedCursor: cursorSchema,
  hasMore: z.boolean(),
  items: z.array(childProfileProjectionSchema),
  nextSnapshotCursor: cursorSchema.nullable(),
  serverTime: utcTimestampSchema,
});

export const childProfileSyncMutationSchema = z.object({
  baseRevision: revisionSchema,
  entityId: uuidV7Schema,
  entityType: z.literal("child"),
  idempotencyKey: uuidV7Schema,
  localDependencyIds: z.array(uuidV7Schema).max(50),
  mutationId: uuidV7Schema,
  operation: z.literal("update"),
  payload: z.object({
    dateOfBirth: z.string().date(),
    preferredName: z.string().trim().min(1).max(120),
  }),
});

export const syncMutationPushRequestSchema = z.object({
  mutations: z.array(childProfileSyncMutationSchema).min(1).max(50),
});

const syncMutationResultBaseSchema = z.object({
  entityId: uuidV7Schema,
  mutationId: uuidV7Schema,
});

export const syncMutationResultSchema = z.discriminatedUnion("status", [
  syncMutationResultBaseSchema.extend({
    entity: childProfileProjectionSchema,
    status: z.enum(["applied", "duplicate"]),
  }),
  syncMutationResultBaseSchema.extend({
    current: childProfileProjectionSchema,
    reason: z.literal("staleCriticalRevision"),
    status: z.literal("conflict"),
  }),
  syncMutationResultBaseSchema.extend({
    reason: z.enum([
      "authorizationDenied",
      "dependencyFailed",
      "dependencyMissing",
      "idempotencyMismatch",
      "tombstoneWins",
      "unsupportedMutation",
      "validationFailed",
    ]),
    status: z.literal("rejected"),
  }),
]);

export const syncMutationPushResponseSchema = z.object({
  results: z.array(syncMutationResultSchema),
  serverTime: utcTimestampSchema,
});
