import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import {
  auditEventSchema,
  childIdentifierSchema,
  consentEventSchema,
  contractMetadataSchema,
  householdIdentifierSchema,
  idempotencyKeySchema,
  ownerOnboardingRequestSchema,
  ownerOnboardingResponseSchema,
  paginatedResponseSchema,
  problemDetailsSchema,
  recordDescriptorSchema,
  syncMutationSchema,
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
registry.register("OwnerOnboardingRequest", ownerOnboardingRequestSchema);
registry.register("OwnerOnboardingResponse", ownerOnboardingResponseSchema);

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
      description: "Versioned LittleArc API contract with OFF-02 household onboarding.",
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
    ],
  }) as unknown as GeneratedOpenApiDocument;
}
