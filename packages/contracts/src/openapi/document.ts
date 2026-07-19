import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import {
  auditEventSchema,
  childIdentifierSchema,
  consentEventSchema,
  contractMetadataSchema,
  householdIdentifierSchema,
  paginatedResponseSchema,
  problemDetailsSchema,
  recordDescriptorSchema,
  syncMutationSchema,
  z,
} from "../schema-source/index.js";

const registry = new OpenAPIRegistry();

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
      description: "Versioned LittleArc API contract established by FND-04.",
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
    ],
  }) as unknown as GeneratedOpenApiDocument;
}
