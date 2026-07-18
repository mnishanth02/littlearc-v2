import { dirname, resolve, sep } from "node:path";

export const expectedWorkspaces = new Map([
  ["apps/api", "@littlearc/api"],
  ["apps/mobile", "@littlearc/mobile"],
  ["apps/ops-web", "@littlearc/ops-web"],
  ["apps/worker", "@littlearc/worker"],
  ["packages/auth", "@littlearc/auth"],
  ["packages/config", "@littlearc/config"],
  ["packages/contracts", "@littlearc/contracts"],
  ["packages/crypto", "@littlearc/crypto"],
  ["packages/database", "@littlearc/database"],
  ["packages/design-tokens", "@littlearc/design-tokens"],
  ["packages/domain", "@littlearc/domain"],
  ["packages/observability", "@littlearc/observability"],
  ["packages/test-kit", "@littlearc/test-kit"],
]);

export const quarantinedSourcePrefixes = [
  "apps/mobile/src/app/",
  "apps/mobile/src/components/",
  "apps/mobile/src/theme/",
  "packages/design-tokens/src/",
];

const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const forbiddenDomainDependencies = [
  "drizzle-orm",
  "fastify",
  "next",
  "react",
  "react-native",
  "expo",
];

function isApplication(directory) {
  return directory.startsWith("apps/");
}

function isExactVersion(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version);
}

function allDependencies(manifest) {
  return dependencySections.flatMap((section) =>
    Object.entries(manifest[section] ?? {}).map(([name, version]) => ({
      name,
      section,
      version,
    })),
  );
}

export function validatePackageGraph(packages) {
  const violations = [];
  const internalByName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));

  for (const pkg of packages) {
    const { directory, manifest } = pkg;

    if (manifest.private !== true) {
      violations.push(`${manifest.name}: private must be true`);
    }

    for (const dependency of allDependencies(manifest)) {
      const target = internalByName.get(dependency.name);

      if (target && dependency.version !== "workspace:*") {
        violations.push(
          `${manifest.name}: internal dependency ${dependency.name} must use workspace:*`,
        );
      }

      if (!target && !isExactVersion(dependency.version)) {
        violations.push(
          `${manifest.name}: external dependency ${dependency.name} must use an exact version; found ${dependency.version}`,
        );
      }

      if (!target) {
        continue;
      }

      if (!isApplication(directory) && isApplication(target.directory)) {
        violations.push(`${manifest.name}: packages must not depend on application ${dependency.name}`);
      }

      if (isApplication(directory) && isApplication(target.directory)) {
        violations.push(
          `${manifest.name}: applications must not depend on application ${dependency.name}`,
        );
      }

      if (manifest.name === "@littlearc/contracts" && dependency.name === "@littlearc/database") {
        violations.push("@littlearc/contracts: contracts must not depend on database models");
      }

      if (manifest.name === "@littlearc/ops-web" && dependency.name === "@littlearc/database") {
        violations.push("@littlearc/ops-web: staff web must use API contracts, not the database package");
      }

      if (
        manifest.name === "@littlearc/mobile" &&
        ["@littlearc/api", "@littlearc/database", "@littlearc/worker"].includes(dependency.name)
      ) {
        violations.push(
          `@littlearc/mobile: mobile must not depend on backend implementation ${dependency.name}`,
        );
      }
    }

    if (manifest.name === "@littlearc/domain") {
      for (const dependency of allDependencies(manifest)) {
        if (
          forbiddenDomainDependencies.some(
            (name) => dependency.name === name || dependency.name.startsWith(`${name}-`),
          )
        ) {
          violations.push(
            `@littlearc/domain: framework or provider dependency ${dependency.name} is forbidden`,
          );
        }
      }
    }
  }

  return violations;
}

export function validateWorkspaceConfig(workspaceConfig) {
  const violations = [];

  if (!workspaceConfig.includes("- apps/*") || !workspaceConfig.includes("- packages/*")) {
    violations.push("pnpm-workspace.yaml: expected apps/* and packages/* workspace globs");
  }
  if (workspaceConfig.includes("spikes")) {
    violations.push("pnpm-workspace.yaml: spikes/native-compat must remain outside the root workspace");
  }

  return violations;
}

export function findEscapingRelativeImports(packageRoot, file, source) {
  return findImportSpecifiers(source).flatMap((specifier) => {
    if (!specifier.startsWith(".")) {
      return [];
    }

    const target = resolve(dirname(file), specifier);
    const insidePackage = target === packageRoot || target.startsWith(`${packageRoot}${sep}`);
    return insidePackage ? [] : [specifier];
  });
}

export function findImportSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

export function findUndeclaredWorkspaceImports(source, packageName, declaredDependencies) {
  return findImportSpecifiers(source).filter((specifier) => {
    if (!specifier.startsWith("@littlearc/")) {
      return false;
    }

    const importedPackage = specifier.split("/").slice(0, 2).join("/");
    return importedPackage !== packageName && !declaredDependencies.has(importedPackage);
  });
}
