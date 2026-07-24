import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import {
  auditEventSchema,
  childIdentifierSchema,
  childProfileProjectionSchema,
  childProfileSyncMutationSchema,
  consentEventSchema,
  contractMetadataSchema,
  deviceEnrollmentRequestSchema,
  deviceEnrollmentResponseSchema,
  emergencyCardProjectionSchema,
  emergencyCardPutRequestSchema,
  householdIdentifierSchema,
  idempotencyKeySchema,
  ownerOnboardingRequestSchema,
  ownerOnboardingResponseSchema,
  paginatedResponseSchema,
  problemDetailsSchema,
  recordDescriptorSchema,
  recordProjectionSchema,
  recordVersionPageSchema,
  recordVersionProjectionSchema,
  syncMutationPushRequestSchema,
  syncMutationPushResponseSchema,
  syncMutationResultSchema,
  syncMutationSchema,
  syncPullResponseSchema,
  syncSnapshotPageSchema,
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
