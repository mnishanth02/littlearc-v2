type OpenApiDocument = {
  readonly paths?: Record<string, Record<string, unknown>>;
};

export type BreakingContractChange = {
  readonly kind: "path_removed" | "method_removed" | "response_removed";
  readonly location: string;
};

const httpMethods = ["get", "put", "post", "delete", "patch", "options", "head", "trace"] as const;

function responses(operation: unknown): Record<string, unknown> {
  if (!operation || typeof operation !== "object" || !("responses" in operation)) {
    return {};
  }

  const candidate = operation.responses;
  return candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};
}

export function detectBreakingContractChanges(
  previous: OpenApiDocument,
  next: OpenApiDocument,
): ReadonlyArray<BreakingContractChange> {
  const changes: BreakingContractChange[] = [];
  const previousPaths = previous.paths ?? {};
  const nextPaths = next.paths ?? {};

  for (const [path, previousPathItem] of Object.entries(previousPaths)) {
    const nextPathItem = nextPaths[path];

    if (!nextPathItem) {
      changes.push({ kind: "path_removed", location: path });
      continue;
    }

    for (const method of httpMethods) {
      const previousOperation = previousPathItem[method];

      if (!previousOperation) {
        continue;
      }

      const nextOperation = nextPathItem[method];
      if (!nextOperation) {
        changes.push({ kind: "method_removed", location: `${method.toUpperCase()} ${path}` });
        continue;
      }

      for (const statusCode of Object.keys(responses(previousOperation))) {
        if (!(statusCode in responses(nextOperation))) {
          changes.push({
            kind: "response_removed",
            location: `${method.toUpperCase()} ${path} ${statusCode}`,
          });
        }
      }
    }
  }

  return changes;
}
