import {
  auditActions,
  confirmationStates,
  consentPurposes,
  consentStates,
  emergencyCardAccessModes,
  recordAccessScopes,
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
  localSchemaVersion: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  platform: z.enum(["android", "ios"]),
});

export const deviceEnrollmentResponseSchema = z.object({
  deviceId: uuidV7Schema,
  enrollmentStatus: z.literal("active"),
  householdId: uuidV7Schema,
  localSchemaVersion: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
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
export const recordAccessScopeSchema = z.enum(recordAccessScopes);

export const optionalConfirmedTextSchema = (maximum: number) =>
  z.discriminatedUnion("state", [
    z.object({ state: z.literal("notProvided") }),
    z.object({
      state: z.literal("confirmed"),
      value: z.string().trim().min(1).max(maximum),
    }),
  ]);

export const optionalConfirmedDateSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("notProvided") }),
  z.object({
    state: z.literal("confirmed"),
    value: z.string().date(),
  }),
]);

export const recordVersionContentV1Schema = z.object({
  details: z.discriminatedUnion("schema", [
    z.object({
      documentKind: optionalConfirmedTextSchema(120),
      schema: z.literal("document.v1"),
    }),
    z.object({
      batchLot: optionalConfirmedTextSchema(120),
      dateMeaning: z.discriminatedUnion("state", [
        z.object({ state: z.literal("notProvided") }),
        z.object({
          state: z.literal("confirmed"),
          value: z.enum(["due", "given"]),
        }),
      ]),
      schema: z.literal("vaccination.v1"),
      vaccineName: z.string().trim().min(1).max(160),
    }),
    z.object({
      followUpDate: optionalConfirmedDateSchema,
      reasonForVisit: z.string().trim().min(1).max(500),
      schema: z.literal("doctor_visit.v1"),
      tags: optionalConfirmedTextSchema(240),
    }),
    z.object({
      duration: optionalConfirmedTextSchema(160),
      endDate: optionalConfirmedDateSchema,
      medicines: z.string().trim().min(1).max(1_000),
      schema: z.literal("prescription.v1"),
      writtenSchedule: optionalConfirmedTextSchema(1_000),
    }),
  ]),
  notes: optionalConfirmedTextSchema(2_000),
  providerFacility: optionalConfirmedTextSchema(160),
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(160),
});

export const recordProvenanceSchema = z.object({
  sourceType: recordSourceTypeSchema,
  trustedIssuer: z.boolean(),
});

export const recordDescriptorSchema = mutableResourceSchema.extend({
  childId: uuidV7Schema,
  category: recordCategorySchema,
  sourceType: recordSourceTypeSchema,
  confirmationState: confirmationStateSchema,
  accessScope: recordAccessScopeSchema,
});

export const syncMutationSchema = z.object({
  mutationId: uuidV7Schema,
  entityType: z.enum(["child", "consent", "record", "emergencyCard", "timelineEntry"]),
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

export const emergencyCardContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  relationship: z.string().trim().min(1).max(80),
});

export const emergencyCardScalarSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("notProvided") }),
  z.object({ state: z.literal("confirmed"), value: z.string().trim().min(1).max(16) }),
]);

export const emergencyCardListSchema = (maximumItemLength: number) =>
  z.discriminatedUnion("state", [
    z.object({ state: z.literal("notProvided") }),
    z.object({ state: z.literal("noneConfirmed") }),
    z.object({
      state: z.literal("confirmed"),
      values: z.array(z.string().trim().min(1).max(maximumItemLength)).min(1).max(20),
    }),
  ]);

export const emergencyCardContentSchema = z.object({
  allergies: emergencyCardListSchema(160),
  bloodGroup: emergencyCardScalarSchema,
  criticalNotes: emergencyCardListSchema(500),
  dateOfBirth: z.string().date(),
  guardianContacts: z.array(emergencyCardContactSchema).min(1).max(5),
  pediatrician: z.discriminatedUnion("state", [
    z.object({ state: z.literal("notProvided") }),
    z.object({
      state: z.literal("confirmed"),
      name: z.string().trim().min(1).max(120),
      phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    }),
  ]),
  preferredName: z.string().trim().min(1).max(120),
  urgentMedications: emergencyCardListSchema(160),
});

export const emergencyCardProjectionSchema = z.object({
  accessMode: z.enum(emergencyCardAccessModes),
  cardId: uuidV7Schema,
  childId: uuidV7Schema,
  content: emergencyCardContentSchema,
  revision: revisionSchema,
  updatedAt: utcTimestampSchema,
  version: revisionSchema,
});

export const recordProjectionSchema = z.object({
  accessScope: recordAccessScopeSchema,
  category: recordCategorySchema,
  childId: uuidV7Schema,
  confirmationState: z.enum(["draft", "suggested", "confirmed", "archived"]),
  content: recordVersionContentV1Schema,
  eventAt: utcTimestampSchema.nullable(),
  provenance: recordProvenanceSchema,
  recordId: uuidV7Schema,
  revision: revisionSchema,
  updatedAt: utcTimestampSchema,
  version: revisionSchema,
  versionId: uuidV7Schema,
});

export const recordVersionProjectionSchema = z.object({
  confirmedAt: utcTimestampSchema.nullable(),
  confirmationState: confirmationStateSchema,
  content: recordVersionContentV1Schema,
  createdAt: utcTimestampSchema,
  provenance: recordProvenanceSchema,
  recordId: uuidV7Schema,
  supersedesVersionId: uuidV7Schema.nullable(),
  version: revisionSchema,
  versionId: uuidV7Schema,
});

export const generatedTimelineContentSchema = z.object({
  category: recordCategorySchema,
  dateAuthority: z.enum(["recordEventAt", "confirmedAtFallback"]),
  title: z.string().trim().min(1).max(160),
});

export const generatedTimelineProjectionSchema = z.object({
  childId: uuidV7Schema,
  content: generatedTimelineContentSchema,
  entryId: uuidV7Schema,
  eventAt: utcTimestampSchema,
  recordId: uuidV7Schema,
  revision: revisionSchema,
  sourceVersionId: uuidV7Schema,
  updatedAt: utcTimestampSchema,
});

export const syncChangeSchema = z.union([
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
  z.object({
    changedAt: utcTimestampSchema,
    entity: emergencyCardProjectionSchema,
    entityId: uuidV7Schema,
    entityType: z.literal("emergencyCard"),
    operation: z.literal("upsert"),
    revision: revisionSchema,
    sequence: z.number().int().positive(),
  }),
  z.object({
    changedAt: utcTimestampSchema,
    entityId: uuidV7Schema,
    entityType: z.literal("emergencyCard"),
    operation: z.literal("delete"),
    revision: revisionSchema,
    sequence: z.number().int().positive(),
  }),
  z.object({
    changedAt: utcTimestampSchema,
    entity: recordProjectionSchema,
    entityId: uuidV7Schema,
    entityType: z.literal("record"),
    operation: z.literal("upsert"),
    revision: revisionSchema,
    sequence: z.number().int().positive(),
  }),
  z.object({
    changedAt: utcTimestampSchema,
    entityId: uuidV7Schema,
    entityType: z.literal("record"),
    operation: z.literal("delete"),
    revision: revisionSchema,
    sequence: z.number().int().positive(),
  }),
  z.object({
    changedAt: utcTimestampSchema,
    entity: generatedTimelineProjectionSchema,
    entityId: uuidV7Schema,
    entityType: z.literal("timelineEntry"),
    operation: z.literal("upsert"),
    revision: revisionSchema,
    sequence: z.number().int().positive(),
  }),
  z.object({
    changedAt: utcTimestampSchema,
    entityId: uuidV7Schema,
    entityType: z.literal("timelineEntry"),
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
  items: z.array(
    z.union([
      childProfileProjectionSchema,
      emergencyCardProjectionSchema,
      recordProjectionSchema,
      generatedTimelineProjectionSchema,
    ]),
  ),
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

export const emergencyCardSyncMutationSchema = z.object({
  baseRevision: revisionSchema.nullable(),
  entityId: uuidV7Schema,
  entityType: z.literal("emergencyCard"),
  idempotencyKey: uuidV7Schema,
  localDependencyIds: z.array(uuidV7Schema).max(50),
  mutationId: uuidV7Schema,
  operation: z.enum(["create", "update"]),
  payload: z.object({
    accessMode: z.enum(emergencyCardAccessModes),
    childId: uuidV7Schema,
    content: emergencyCardContentSchema,
  }),
});

const recordMutationContentSchema = z.object({
  category: recordCategorySchema,
  childId: uuidV7Schema,
  content: recordVersionContentV1Schema,
  eventAt: utcTimestampSchema.nullable(),
  sourceType: recordSourceTypeSchema,
});

export const recordCreateSyncMutationSchema = z.object({
  baseRevision: z.null(),
  entityId: uuidV7Schema,
  entityType: z.literal("record"),
  idempotencyKey: uuidV7Schema,
  localDependencyIds: z.array(uuidV7Schema).max(50),
  mutationId: uuidV7Schema,
  operation: z.literal("create"),
  payload: recordMutationContentSchema,
});

export const recordCorrectSyncMutationSchema = z.object({
  baseRevision: revisionSchema,
  entityId: uuidV7Schema,
  entityType: z.literal("record"),
  idempotencyKey: uuidV7Schema,
  localDependencyIds: z.array(uuidV7Schema).max(50),
  mutationId: uuidV7Schema,
  operation: z.literal("update"),
  payload: recordMutationContentSchema,
});

export const recordDeleteSyncMutationSchema = z.object({
  baseRevision: revisionSchema,
  entityId: uuidV7Schema,
  entityType: z.literal("record"),
  idempotencyKey: uuidV7Schema,
  localDependencyIds: z.array(uuidV7Schema).max(50),
  mutationId: uuidV7Schema,
  operation: z.literal("delete"),
});

export const syncMutationPushRequestSchema = z.object({
  mutations: z
    .array(
      z.union([
        childProfileSyncMutationSchema,
        emergencyCardSyncMutationSchema,
        recordCreateSyncMutationSchema,
        recordCorrectSyncMutationSchema,
        recordDeleteSyncMutationSchema,
      ]),
    )
    .min(1)
    .max(50),
});

const syncMutationResultBaseSchema = z.object({
  entityId: uuidV7Schema,
  mutationId: uuidV7Schema,
});

export const syncMutationResultSchema = z.discriminatedUnion("status", [
  syncMutationResultBaseSchema.extend({
    entity: z.union([
      childProfileProjectionSchema,
      emergencyCardProjectionSchema,
      recordProjectionSchema,
    ]),
    status: z.enum(["applied", "duplicate"]),
  }),
  syncMutationResultBaseSchema.extend({
    current: z.union([
      childProfileProjectionSchema,
      emergencyCardProjectionSchema,
      recordProjectionSchema,
    ]),
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

export const emergencyCardPutRequestSchema = z.object({
  baseRevision: revisionSchema.nullable(),
  childId: uuidV7Schema,
  content: emergencyCardContentSchema,
  mutationId: uuidV7Schema,
});

export const recordVersionPageSchema = z.object({
  items: z.array(recordVersionProjectionSchema),
  nextCursor: cursorSchema.nullable(),
});
