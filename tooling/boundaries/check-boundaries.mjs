import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  expectedWorkspaces,
  findEscapingRelativeImports,
  findUndeclaredWorkspaceImports,
  validatePackageGraph,
  validateWorkspaceConfig,
} from "./policy.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function workspacePackages() {
  return [...expectedWorkspaces].map(([directory, expectedName]) => {
    const manifestPath = join(repositoryRoot, directory, "package.json");
    const manifest = readJson(manifestPath);

    return { directory, expectedName, manifest, manifestPath };
  });
}

function walk(directory) {
  if (!statSync(directory).isDirectory()) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function relativeImportViolations(pkg) {
  const packageRoot = join(repositoryRoot, pkg.directory);
  const sourceRoot = join(packageRoot, "src");
  const declaredDependencies = new Set(
    [
      pkg.manifest.dependencies,
      pkg.manifest.devDependencies,
      pkg.manifest.optionalDependencies,
      pkg.manifest.peerDependencies,
    ].flatMap((section) => Object.keys(section ?? {})),
  );

  try {
    return walk(sourceRoot).flatMap((file) => {
      const filePath = relative(repositoryRoot, file);
      const extension = file.slice(file.lastIndexOf("."));
      if (!sourceExtensions.has(extension)) {
        return [];
      }

      const source = readFileSync(file, "utf8");
      const escapingImports = findEscapingRelativeImports(packageRoot, file, source).map(
        (specifier) =>
          `${pkg.manifest.name}: relative import escapes workspace in ${filePath}: ${specifier}`,
      );
      const undeclaredImports = findUndeclaredWorkspaceImports(
        source,
        pkg.manifest.name,
        declaredDependencies,
      )
        .map(
          (specifier) =>
            `${pkg.manifest.name}: undeclared workspace import in ${filePath}: ${specifier}`,
        );

      return [...escapingImports, ...undeclaredImports];
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

const packages = workspacePackages();
const violations = [];
const observedNames = new Set();

for (const pkg of packages) {
  if (pkg.manifest.name !== pkg.expectedName) {
    violations.push(`${pkg.directory}: expected package name ${pkg.expectedName}; found ${pkg.manifest.name}`);
  }

  if (observedNames.has(pkg.manifest.name)) {
    violations.push(`${pkg.manifest.name}: duplicate workspace package name`);
  }
  observedNames.add(pkg.manifest.name);
  violations.push(...relativeImportViolations(pkg));
}

const workspaceConfig = readFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8");
violations.push(...validateWorkspaceConfig(workspaceConfig));

const rootManifest = readJson(join(repositoryRoot, "package.json"));
violations.push(
  ...validatePackageGraph([
    ...packages,
    { directory: ".", manifest: rootManifest },
  ]),
);

if (violations.length === 0) {
  console.log(`Workspace boundaries verified: ${packages.length} package nodes`);
} else {
  for (const violation of violations) {
    console.error(`workspace_boundary_violation: ${violation}`);
  }
  process.exitCode = 1;
}
