import { describe, expect, it } from "vitest";
import {
  findEscapingRelativeImports,
  findImportSpecifiers,
  findUndeclaredWorkspaceImports,
  validatePackageGraph,
  validateWorkspaceConfig,
} from "./policy.mjs";

type TestPackage = {
  directory: string;
  manifest: {
    dependencies?: Record<string, string>;
    name: string;
    private: boolean;
  };
};

const pkg = (
  directory: string,
  name: string,
  dependencies: Record<string, string> = {},
): TestPackage => ({
  directory,
  manifest: { dependencies, name, private: true },
});

describe("workspace boundary policy", () => {
  it("accepts an allowed package graph", () => {
    const graph = [
      pkg("apps/api", "@littlearc/api", { "@littlearc/domain": "workspace:*" }),
      pkg("packages/domain", "@littlearc/domain"),
    ];

    expect(validatePackageGraph(graph)).toEqual([]);
  });

  it.each([
    {
      graph: [pkg("packages/domain", "@littlearc/domain", { fastify: "5.6.2" })],
      message: "framework or provider dependency fastify is forbidden",
      scenario: "framework dependency in domain",
    },
    {
      graph: [
        pkg("packages/contracts", "@littlearc/contracts", {
          "@littlearc/database": "workspace:*",
        }),
        pkg("packages/database", "@littlearc/database"),
      ],
      message: "contracts must not depend on database models",
      scenario: "database dependency in contracts",
    },
    {
      graph: [
        pkg("apps/ops-web", "@littlearc/ops-web", { "@littlearc/database": "workspace:*" }),
        pkg("packages/database", "@littlearc/database"),
      ],
      message: "staff web must use API contracts",
      scenario: "database dependency in staff web",
    },
    {
      graph: [
        pkg("apps/mobile", "@littlearc/mobile", { "@littlearc/api": "workspace:*" }),
        pkg("apps/api", "@littlearc/api"),
      ],
      message: "applications must not depend on application @littlearc/api",
      scenario: "application-to-application dependency",
    },
    {
      graph: [
        pkg("packages/domain", "@littlearc/domain", { "@littlearc/api": "workspace:*" }),
        pkg("apps/api", "@littlearc/api"),
      ],
      message: "packages must not depend on application @littlearc/api",
      scenario: "package-to-application dependency",
    },
    {
      graph: [pkg("packages/config", "@littlearc/config", { zod: "^4.0.0" })],
      message: "external dependency zod must use an exact version",
      scenario: "ranged external version",
    },
    {
      graph: [
        pkg("apps/api", "@littlearc/api", { "@littlearc/domain": "0.0.0" }),
        pkg("packages/domain", "@littlearc/domain"),
      ],
      message: "internal dependency @littlearc/domain must use workspace:*",
      scenario: "non-workspace internal version",
    },
  ])("rejects $scenario", ({ graph, message }) => {
    expect(validatePackageGraph(graph).join("\n")).toContain(message);
  });

  it("rejects a publishable workspace", () => {
    const graph = [
      {
        directory: "packages/domain",
        manifest: { name: "@littlearc/domain", private: false },
      },
    ];

    expect(validatePackageGraph(graph).join("\n")).toContain("private must be true");
  });

  it("rejects inclusion of the retained native spike", () => {
    const config = "packages:\n  - apps/*\n  - packages/*\n  - spikes/*\n";

    expect(validateWorkspaceConfig(config).join("\n")).toContain(
      "spikes/native-compat must remain outside",
    );
  });

  it("rejects relative imports that escape a workspace", () => {
    const packageRoot = "/repo/apps/mobile";
    const file = "/repo/apps/mobile/src/theme/index.ts";
    const source = 'import value from "../../../../outside";';

    expect(findEscapingRelativeImports(packageRoot, file, source)).toEqual(["../../../../outside"]);
  });

  it("accepts relative imports that remain inside a workspace", () => {
    const packageRoot = "/repo/apps/mobile";
    const file = "/repo/apps/mobile/src/theme/index.ts";
    const source = 'export { value } from "../value";';

    expect(findEscapingRelativeImports(packageRoot, file, source)).toEqual([]);
  });

  it("extracts a bare workspace import for source-to-manifest validation", () => {
    const source = 'import { value } from "@littlearc/domain";';

    expect(findImportSpecifiers(source)).toEqual(["@littlearc/domain"]);
  });

  it("rejects an undeclared workspace source import", () => {
    const source = 'import { value } from "@littlearc/domain/policy";';

    expect(findUndeclaredWorkspaceImports(source, "@littlearc/api", new Set())).toEqual([
      "@littlearc/domain/policy",
    ]);
    expect(
      findUndeclaredWorkspaceImports(source, "@littlearc/api", new Set(["@littlearc/domain"])),
    ).toEqual([]);
  });
});
