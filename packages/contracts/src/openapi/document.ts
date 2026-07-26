import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import {
  auditEventSchema,
  childIdentifierSchema,
  childProfileProjectionSchema,
  childProfileSyncMutationSchema,
  completeUploadRequestSchema,
  consentEventSchema,
  contractMetadataSchema,
  createUploadSessionRequestSchema,
  deviceEnrollmentRequestSchema,
  deviceEnrollmentResponseSchema,
  emergencyCardProjectionSchema,
  emergencyCardPutRequestSchema,
  fileDownloadGrantSchema,
  fileObjectProjectionSchema,
  filePreviewDownloadGrantSchema,
  fileProcessingStatusSchema,
  householdIdentifierSchema,
  idempotencyKeySchema,
  ownerOnboardingRequestSchema,
  ownerOnboardingResponseSchema,
  paginatedResponseSchema,
  problemDetailsSchema,
  reconcileUploadPartsRequestSchema,
  recordDescriptorSchema,
  recordProjectionSchema,
  recordVersionPageSchema,
  recordVersionProjectionSchema,
  signedUploadPartSchema,
  syncMutationPushRequestSchema,
  syncMutationPushResponseSchema,
  syncMutationResultSchema,
  syncMutationSchema,
  syncPullResponseSchema,
  syncSnapshotPageSchema,
  uploadSessionSchema,
  uuidV7Schema,
  z,
} from "../schema-source/index.js";

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "consumerSession", {
  type: "apiKey",
  in: "cookie",
  name: "better-auth.session_token",
});

export type GeneratedOpenApiDocument = {
  readonly openapi: "3.1.0";
  readonly info: {
    readonly title: string;
    readonly version: string;
    readonly description?: string;
  };
  readonly paths: Record<string, unknown>;
  readonly components?: Record<string, unknown>;
  readonly tags?: ReadonlyArray<Record<string, unknown>>;
  readonly servers?: ReadonlyArray<Record<string, unknown>>;
};

registry.register("ProblemDetails", problemDetailsSchema);
registry.register("ContractMetadata", contractMetadataSchema);
registry.register("PaginatedResponse", paginatedResponseSchema);
registry.register("HouseholdIdentifier", householdIdentifierSchema);
registry.register("ChildIdentifier", childIdentifierSchema);
registry.register("ConsentEvent", consentEventSchema);
registry.register("AuditEvent", auditEventSchema);
registry.register("RecordDescriptor", recordDescriptorSchema);
registry.register("SyncMutation", syncMutationSchema);
registry.register("ChildProfileProjection", childProfileProjectionSchema);
registry.register("ChildProfileSyncMutation", childProfileSyncMutationSchema);
registry.register("SyncMutationResult", syncMutationResultSchema);
registry.register("SyncPullResponse", syncPullResponseSchema);
registry.register("SyncSnapshotPage", syncSnapshotPageSchema);
registry.register("SyncMutationPushRequest", syncMutationPushRequestSchema);
registry.register("SyncMutationPushResponse", syncMutationPushResponseSchema);
registry.register("OwnerOnboardingRequest", ownerOnboardingRequestSchema);
registry.register("OwnerOnboardingResponse", ownerOnboardingResponseSchema);
registry.register("DeviceEnrollmentRequest", deviceEnrollmentRequestSchema);
registry.register("DeviceEnrollmentResponse", deviceEnrollmentResponseSchema);
registry.register("EmergencyCardProjection", emergencyCardProjectionSchema);
registry.register("EmergencyCardPutRequest", emergencyCardPutRequestSchema);
registry.register("RecordProjection", recordProjectionSchema);
registry.register("RecordVersionProjection", recordVersionProjectionSchema);
registry.register("RecordVersionPage", recordVersionPageSchema);
registry.register("CreateUploadSessionRequest", createUploadSessionRequestSchema);
registry.register("UploadSession", uploadSessionSchema);
registry.register("SignedUploadPart", signedUploadPartSchema);
registry.register("ReconcileUploadPartsRequest", reconcileUploadPartsRequestSchema);
registry.register("CompleteUploadRequest", completeUploadRequestSchema);
registry.register("FileObjectProjection", fileObjectProjectionSchema);
registry.register("FileDownloadGrant", fileDownloadGrantSchema);
registry.register("FilePreviewDownloadGrant", filePreviewDownloadGrantSchema);
registry.register("FileProcessingStatus", fileProcessingStatusSchema);

registry.registerPath({
  method: "post",
  path: "/v1/files/uploads",
  tags: ["files"],
  summary: "Create an authorized encrypted multipart upload session",
  security: [{ consumerSession: [] }],
  request: {
    headers: z.object({ "idempotency-key": idempotencyKeySchema }),
    body: { content: { "application/json": { schema: createUploadSessionRequestSchema } } },
  },
  responses: {
    201: {
      description: "Encrypted upload session created",
      content: { "application/json": { schema: uploadSessionSchema } },
    },
    200: {
      description: "Idempotent upload session replayed",
      content: { "application/json": { schema: uploadSessionSchema } },
    },
    400: {
      description: "Upload request is invalid",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    401: {
      description: "Consumer session required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    403: {
      description: "Active enrollment and record capability required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    503: {
      description: "Encrypted uploads are disabled or unavailable",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/files/{fileObjectId}/status",
  tags: ["files"],
  summary: "Read privacy-safe worker processing state",
  security: [{ consumerSession: [] }],
  request: { params: z.object({ fileObjectId: uuidV7Schema }) },
  responses: {
    200: {
      description: "Current authorized file-processing state",
      content: { "application/json": { schema: fileProcessingStatusSchema } },
    },
    404: {
      description: "File object not found",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/files/uploads/{sessionId}",
  tags: ["files"],
  summary: "Read safe resumable upload state",
  security: [{ consumerSession: [] }],
  request: { params: z.object({ sessionId: uuidV7Schema }) },
  responses: {
    200: {
      description: "Current authorized upload state",
      content: { "application/json": { schema: uploadSessionSchema } },
    },
    404: {
      description: "Upload session not found",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/files/uploads/{sessionId}/parts/{partNumber}",
  tags: ["files"],
  summary: "Issue a short-lived signed ciphertext part URL",
  security: [{ consumerSession: [] }],
  request: {
    params: z.object({
      partNumber: z.coerce.number().int().min(1).max(10_000),
      sessionId: uuidV7Schema,
    }),
  },
  responses: {
    200: {
      description: "Short-lived signed part URL",
      content: { "application/json": { schema: signedUploadPartSchema } },
    },
    409: {
      description: "Upload session is not retryable",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/files/uploads/{sessionId}/reconcile",
  tags: ["files"],
  summary: "Reconcile client and provider multipart facts",
  security: [{ consumerSession: [] }],
  request: {
    params: z.object({ sessionId: uuidV7Schema }),
    body: { content: { "application/json": { schema: reconcileUploadPartsRequestSchema } } },
  },
  responses: {
    200: {
      description: "Reconciled upload state",
      content: { "application/json": { schema: uploadSessionSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/files/uploads/{sessionId}/complete",
  tags: ["files"],
  summary: "Complete and verify encrypted multipart upload",
  security: [{ consumerSession: [] }],
  request: {
    headers: z.object({ "idempotency-key": idempotencyKeySchema }),
    params: z.object({ sessionId: uuidV7Schema }),
    body: { content: { "application/json": { schema: completeUploadRequestSchema } } },
  },
  responses: {
    200: {
      description: "Uploaded ciphertext integrity accepted",
      content: { "application/json": { schema: fileObjectProjectionSchema } },
    },
    409: {
      description: "Multipart or integrity state conflicts",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/files/uploads/{sessionId}",
  tags: ["files"],
  summary: "Cancel an encrypted multipart upload while preserving the device source",
  security: [{ consumerSession: [] }],
  request: { params: z.object({ sessionId: uuidV7Schema }) },
  responses: {
    204: { description: "Upload cancelled or already cancelled" },
    409: {
      description: "Completed upload cannot be cancelled",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/files/{fileObjectId}/download",
  tags: ["files"],
  summary: "Authorize encrypted download to an active enrolled device",
  security: [{ consumerSession: [] }],
  request: {
    headers: z.object({ "x-littlearc-device-id": uuidV7Schema }),
    params: z.object({ fileObjectId: uuidV7Schema }),
  },
  responses: {
    200: {
      description: "Short-lived ciphertext download and transient file key",
      content: { "application/json": { schema: fileDownloadGrantSchema } },
    },
    403: {
      description: "Active enrolled device required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    404: {
      description: "File object not found",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/files/{fileObjectId}/preview",
  tags: ["files"],
  summary: "Authorize an encrypted validation preview to an active enrolled device",
  security: [{ consumerSession: [] }],
  request: {
    headers: z.object({ "x-littlearc-device-id": uuidV7Schema }),
    params: z.object({ fileObjectId: uuidV7Schema }),
  },
  responses: {
    200: {
      description: "Short-lived encrypted preview download and transient derivative key",
      content: { "application/json": { schema: filePreviewDownloadGrantSchema } },
    },
    403: {
      description: "Active enrolled device required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    404: {
      description: "Ready encrypted preview not found",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/records/{recordId}",
  tags: ["records"],
  summary: "Read the current authorized record projection",
  security: [{ consumerSession: [] }],
  request: {
    params: z.object({ recordId: uuidV7Schema }),
  },
  responses: {
    200: {
      description: "Current record projection",
      content: { "application/json": { schema: recordProjectionSchema } },
    },
    401: {
      description: "Consumer session required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    403: {
      description: "Record capability required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    404: {
      description: "Record not found",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/records/{recordId}/versions",
  tags: ["records"],
  summary: "Read immutable authorized record version history",
  security: [{ consumerSession: [] }],
  request: {
    params: z.object({ recordId: uuidV7Schema }),
    query: z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
  },
  responses: {
    200: {
      description: "Immutable record version page",
      content: { "application/json": { schema: recordVersionPageSchema } },
    },
    401: {
      description: "Consumer session required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    403: {
      description: "Record capability required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    404: {
      description: "Record not found",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/emergency-cards/{cardId}",
  tags: ["emergency-cards"],
  summary: "Read the current authorized emergency-card version",
  security: [{ consumerSession: [] }],
  request: {
    params: z.object({ cardId: uuidV7Schema }),
  },
  responses: {
    200: {
      description: "Current confirmed emergency-card projection",
      content: { "application/json": { schema: emergencyCardProjectionSchema } },
    },
    401: {
      description: "Consumer session required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    403: {
      description: "Emergency-card capability required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    404: {
      description: "Emergency card not found",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/emergency-cards/{cardId}",
  tags: ["emergency-cards"],
  summary: "Create or append an immutable emergency-card version",
  security: [{ consumerSession: [] }],
  request: {
    params: z.object({ cardId: uuidV7Schema }),
    headers: z.object({ "idempotency-key": idempotencyKeySchema }),
    body: { content: { "application/json": { schema: emergencyCardPutRequestSchema } } },
  },
  responses: {
    200: {
      description: "Emergency-card version updated or replayed",
      content: { "application/json": { schema: emergencyCardProjectionSchema } },
    },
    201: {
      description: "Emergency card and first immutable version created",
      content: { "application/json": { schema: emergencyCardProjectionSchema } },
    },
    400: {
      description: "Emergency-card request is invalid",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    401: {
      description: "Consumer session required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    403: {
      description: "Emergency-card edit capability required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    409: {
      description: "Stale revision or idempotency conflict",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/sync",
  tags: ["sync"],
  summary: "Pull ordered household changes or request reconciliation",
  security: [{ consumerSession: [] }],
  request: {
    query: z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  },
  responses: {
    200: {
      description: "Ordered changes or a typed reset requirement",
      content: { "application/json": { schema: syncPullResponseSchema } },
    },
    400: {
      description: "Cursor or page request is invalid",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    401: {
      description: "Consumer session required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    403: {
      description: "Active household membership required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/sync/snapshot",
  tags: ["sync"],
  summary: "Read a captured paginated household snapshot",
  security: [{ consumerSession: [] }],
  request: {
    query: z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  },
  responses: {
    200: {
      description: "Captured child repository snapshot page",
      content: { "application/json": { schema: syncSnapshotPageSchema } },
    },
    400: {
      description: "Snapshot cursor or page request is invalid",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    401: {
      description: "Consumer session required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/sync/mutations",
  tags: ["sync"],
  summary: "Push ordered idempotent local mutations",
  security: [{ consumerSession: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: syncMutationPushRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Independent mutation outcomes",
      content: { "application/json": { schema: syncMutationPushResponseSchema } },
    },
    400: {
      description: "Mutation batch is invalid",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
    401: {
      description: "Consumer session required",
      content: { "application/problem+json": { schema: problemDetailsSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/devices/enrollment",
  tags: ["devices"],
  summary: "Enroll the current authenticated installation",
  security: [{ consumerSession: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: deviceEnrollmentRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Device installation enrolled",
      content: {
        "application/json": { schema: deviceEnrollmentResponseSchema },
      },
    },
    200: {
      description: "Active device enrollment replayed",
      content: {
        "application/json": { schema: deviceEnrollmentResponseSchema },
      },
    },
    400: {
      description: "Enrollment request is invalid",
      content: {
        "application/problem+json": { schema: problemDetailsSchema },
      },
    },
    401: {
      description: "Consumer session required",
      content: {
        "application/problem+json": { schema: problemDetailsSchema },
      },
    },
    403: {
      description: "Active household membership required",
      content: {
        "application/problem+json": { schema: problemDetailsSchema },
      },
    },
    409: {
      description: "Device identifier is unavailable or revoked",
      content: {
        "application/problem+json": { schema: problemDetailsSchema },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1",
  tags: ["meta"],
  summary: "Read LittleArc API contract metadata",
  responses: {
    200: {
      description: "Contract metadata and reserved resource groups",
      content: {
        "application/json": {
          schema: contractMetadataSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/households/onboarding",
  tags: ["households"],
  summary: "Create the first synthetic owner household and child atomically",
  security: [{ consumerSession: [] }],
  request: {
    headers: z.object({
      "idempotency-key": idempotencyKeySchema,
    }),
    body: {
      content: {
        "application/json": {
          schema: ownerOnboardingRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Household onboarding aggregate created",
      content: {
        "application/json": {
          schema: ownerOnboardingResponseSchema,
        },
      },
    },
    200: {
      description: "Exact idempotent replay",
      content: {
        "application/json": {
          schema: ownerOnboardingResponseSchema,
        },
      },
    },
    400: {
      description: "Request or policy validation failed",
      content: {
        "application/problem+json": { schema: problemDetailsSchema },
      },
    },
    401: {
      description: "Consumer session required",
      content: {
        "application/problem+json": { schema: problemDetailsSchema },
      },
    },
    409: {
      description: "Idempotency replay or existing-household conflict",
      content: {
        "application/problem+json": { schema: problemDetailsSchema },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/openapi.json",
  tags: ["meta"],
  summary: "Read the generated OpenAPI document",
  responses: {
    200: {
      description: "OpenAPI 3.1 contract document",
      content: {
        "application/json": {
          schema: z
            .object({
              openapi: z.literal("3.1.0"),
            })
            .passthrough(),
        },
      },
    },
  },
});

export function createOpenApiDocument(): GeneratedOpenApiDocument {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "LittleArc API",
      version: "0.1.0",
      description: "Versioned LittleArc API contract through the VLT-02 manual-record slice.",
    },
    servers: [
      {
        url: "http://127.0.0.1:3000",
        description: "Local synthetic development API",
      },
    ],
    tags: [
      {
        name: "meta",
        description: "Contract metadata and generated OpenAPI access",
      },
      {
        name: "households",
        description: "Session-authenticated household enrollment commands",
      },
      {
        name: "devices",
        description: "Authority-neutral authenticated installation enrollment",
      },
      {
        name: "sync",
        description: "Server-authoritative repository synchronization",
      },
      {
        name: "emergency-cards",
        description: "Authorized emergency-card configuration and immutable versions",
      },
    ],
  }) as unknown as GeneratedOpenApiDocument;
}
