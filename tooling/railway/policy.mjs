import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const expectedEnvironment = "staging";
const expectedDataPolicy = "synthetic-only";
const expectedProductionProvisioning = "deferred";
const expectedRegion = "asia-southeast1-eqsg3a";
const serviceConfigNames = new Set([
  "api.railway.json",
  "worker.railway.json",
  "ops-web.railway.json",
  "clamav.railway.json",
]);
const requiredServices = new Map([
  ["littlearc-api-staging", { configFile: "infra/railway/staging/api.railway.json", kind: "web" }],
  ["littlearc-worker-staging", { configFile: "infra/railway/staging/worker.railway.json", kind: "worker" }],
  ["littlearc-clamav-staging", { configFile: "infra/railway/staging/clamav.railway.json", kind: "worker" }],
  ["littlearc-ops-web-staging", { configFile: "infra/railway/staging/ops-web.railway.json", kind: "web" }],
  ["Postgres", { kind: "postgresql" }],
  ["littlearc-documents-staging", { kind: "bucket" }],
  ["littlearc-recovery-staging", { kind: "bucket" }],
]);

const requiredWatchRoots = {
  "clamav.railway.json": ["/infra/railway/staging/clamav/**"],
  "api.railway.json": [
    "/apps/api/**",
    "/packages/contracts/**",
    "/packages/crypto/**",
    "/packages/database/**",
    "/packages/storage/**",
  ],
  "ops-web.railway.json": ["/apps/ops-web/**", "/packages/contracts/**"],
  "worker.railway.json": [
    "/apps/worker/**",
    "/infra/railway/staging/worker/**",
    "/infra/railway/staging/worker-image-dependencies.json",
    "/packages/crypto/**",
    "/packages/database/**",
    "/packages/domain/**",
    "/packages/observability/**",
    "/packages/storage/**",
    "/tooling/file-validation/**",
  ],
};

const requiredSharedWatchRoots = ["/package.json", "/pnpm-lock.yaml", "/pnpm-workspace.yaml", "/turbo.json"];

export function validateRailwayStagingSkeleton(repositoryRoot) {
  const violations = [];
  const stagingRoot = join(repositoryRoot, "infra/railway/staging");
  const productionRoot = join(repositoryRoot, "infra/railway/production");
  const manifestPath = join(stagingRoot, "variables.manifest.json");

  if (existsSync(productionRoot)) {
    violations.push("infra/railway/production must remain absent while FND-06 is staging-only");
  }

  if (!existsSync(manifestPath)) {
    return [`${manifestPath}: missing staging variable manifest`];
  }

  const manifest = readJson(manifestPath);
  violations.push(...validateManifest(manifest));

  for (const configName of serviceConfigNames) {
    const configPath = join(stagingRoot, configName);

    if (!existsSync(configPath)) {
      violations.push(`${configPath}: missing Railway service config`);
      continue;
    }

    violations.push(...validateServiceConfig(configName, readJson(configPath)));
  }
  violations.push(...validateWorkerImageBoundary(repositoryRoot));

  return violations;
}

function validateManifest(manifest) {
  const violations = [];

  if (manifest.environment !== expectedEnvironment) {
    violations.push(`variables.manifest.json: environment must be ${expectedEnvironment}`);
  }
  if (manifest.dataPolicy !== expectedDataPolicy) {
    violations.push(`variables.manifest.json: dataPolicy must be ${expectedDataPolicy}`);
  }
  if (manifest.productionProvisioning !== expectedProductionProvisioning) {
    violations.push(
      `variables.manifest.json: productionProvisioning must be ${expectedProductionProvisioning}`,
    );
  }
  if (manifest.region !== expectedRegion) {
    violations.push(`variables.manifest.json: region must be ${expectedRegion}`);
  }
  if (!Array.isArray(manifest.services)) {
    return [...violations, "variables.manifest.json: services must be an array"];
  }

  const observedServices = new Map();
  for (const service of manifest.services) {
    if (!service || typeof service !== "object") {
      violations.push("variables.manifest.json: each service must be an object");
      continue;
    }

    if (typeof service.name !== "string" || service.name.trim().length === 0) {
      violations.push("variables.manifest.json: each service needs a name");
      continue;
    }

    observedServices.set(service.name, service);
    violations.push(...validateManifestService(service));
  }

  for (const [name, expectation] of requiredServices) {
    const service = observedServices.get(name);
    if (!service) {
      violations.push(`variables.manifest.json: missing service ${name}`);
      continue;
    }

    if (service.kind !== expectation.kind) {
      violations.push(`variables.manifest.json: ${name} kind must be ${expectation.kind}`);
    }
    if (expectation.configFile && service.configFile !== expectation.configFile) {
      violations.push(`variables.manifest.json: ${name} configFile must be ${expectation.configFile}`);
    }
  }

  return violations;
}

function validateManifestService(service) {
  const violations = [];

  if (service.name.includes("production") || service.name.endsWith("-prod")) {
    violations.push(`variables.manifest.json: ${service.name} must not target production`);
  }

  if (!Array.isArray(service.requiredVariables)) {
    violations.push(`variables.manifest.json: ${service.name} requiredVariables must be an array`);
    return violations;
  }

  const variableNames = new Set();
  for (const variable of service.requiredVariables) {
    if (!variable || typeof variable !== "object") {
      violations.push(`variables.manifest.json: ${service.name} variable must be an object`);
      continue;
    }

    if (typeof variable.name !== "string" || variable.name.trim().length === 0) {
      violations.push(`variables.manifest.json: ${service.name} variable needs a name`);
      continue;
    }
    if (variableNames.has(variable.name)) {
      violations.push(`variables.manifest.json: ${service.name} duplicates ${variable.name}`);
    }
    variableNames.add(variable.name);

    if (!["public", "sensitive", "secret"].includes(variable.classification)) {
      violations.push(
        `variables.manifest.json: ${service.name}.${variable.name} has invalid classification`,
      );
    }
    if ("value" in variable) {
      violations.push(`variables.manifest.json: ${service.name}.${variable.name} must not contain a value`);
    }
    if (variable.name === "APP_ENV" && variable.source !== "literal:staging") {
      violations.push(`variables.manifest.json: ${service.name}.APP_ENV must be literal:staging`);
    }
  }

  return violations;
}

function validateServiceConfig(configName, config) {
  const violations = [];
  const isClamav = configName === "clamav.railway.json";
  const isWorker = configName === "worker.railway.json";
  const isDockerService = isClamav || isWorker;

  if (config.$schema !== "https://railway.com/railway.schema.json") {
    violations.push(`${configName}: missing Railway schema URL`);
  }
  if (config.environments?.production) {
    violations.push(`${configName}: must not define production environment overrides`);
  }
  if (config.build?.builder !== (isDockerService ? "DOCKERFILE" : "RAILPACK")) {
    violations.push(
      `${configName}: build.builder must be ${isDockerService ? "DOCKERFILE" : "RAILPACK"}`,
    );
  }
  if (
    (!isDockerService && typeof config.build?.buildCommand !== "string") ||
    (!isDockerService &&
      (!config.build.buildCommand.startsWith("pnpm --filter ") &&
        !config.build.buildCommand.includes("pnpm --filter "))) ||
    (!isDockerService && !config.build.buildCommand.includes("... build"))
  ) {
    violations.push(
      `${configName}: build.buildCommand must use a dependency-inclusive pnpm workspace filter`,
    );
  }
  if (!Array.isArray(config.build?.watchPatterns)) {
    violations.push(`${configName}: build.watchPatterns must be an array`);
  } else {
    const required = [
      ...(requiredWatchRoots[configName] ?? []),
      ...(isClamav ? [] : requiredSharedWatchRoots),
    ];
    for (const pattern of required) {
      if (!config.build.watchPatterns.includes(pattern)) {
        violations.push(`${configName}: missing watch pattern ${pattern}`);
      }
    }
  }

  if (
    !isDockerService &&
    (typeof config.deploy?.startCommand !== "string" ||
      !config.deploy.startCommand.startsWith("pnpm --filter "))
  ) {
    violations.push(`${configName}: deploy.startCommand must use a pnpm workspace filter`);
  }

  if (configName === "worker.railway.json" || isClamav) {
    if ("healthcheckPath" in (config.deploy ?? {})) {
      violations.push("worker.railway.json: worker must not expose a Railway HTTP healthcheck yet");
    }
  } else if (config.deploy?.healthcheckPath !== "/health/ready") {
    violations.push(`${configName}: deploy.healthcheckPath must be /health/ready`);
  }

  if (config.deploy?.restartPolicyType !== "ALWAYS") {
    violations.push(`${configName}: deploy.restartPolicyType must be ALWAYS`);
  }

  return violations;
}

function validateWorkerImageBoundary(repositoryRoot) {
  const violations = [];
  const stagingRoot = join(repositoryRoot, "infra/railway/staging");
  const config = readJson(join(stagingRoot, "worker.railway.json"));
  const dependencyPath = join(stagingRoot, "worker-image-dependencies.json");
  const dockerfilePath = join(stagingRoot, "worker/Dockerfile");

  if (config.build?.dockerfilePath !== "infra/railway/staging/worker/Dockerfile") {
    violations.push("worker.railway.json: worker Dockerfile path must remain exact");
  }
  if (config.deploy?.preDeployCommand !== "node apps/worker/dist/staging-probe.js") {
    violations.push("worker.railway.json: worker must run the exact staging predeploy probe");
  }
  if (config.deploy?.startCommand !== "node apps/worker/dist/index.js") {
    violations.push("worker.railway.json: worker must run the built entry point directly");
  }
  if (!existsSync(dependencyPath)) {
    violations.push("worker-image-dependencies.json: missing exact worker image dependency manifest");
    return violations;
  }
  if (!existsSync(dockerfilePath)) {
    violations.push("worker/Dockerfile: missing reviewed worker image");
    return violations;
  }

  const dependencies = readJson(dependencyPath);
  const expected = {
    baseImage: {
      digest: "sha256:ec82d089a8ae2cf02628da7b34ea57dc357b24db724d557fe2d240e6beb659c1",
      reference: "node:26.4.0-bookworm-slim",
    },
    decoder: {
      libde265: "1.0.11-1+deb12u2",
      libheif: "1.15.1-1+deb12u1",
      libvips: "8.18.3",
      sharp: "0.35.3",
      x265: "3.5-2+b1",
    },
    renderer: {
      jpeg: "1:2.1.5-2",
      png: "1.6.39-2+deb12u5",
      popplerUtils: "22.12.0-2+deb12u2",
    },
    licenses: {
      jpeg:
        "https://metadata.ftp-master.debian.org/changelogs/main/libj/libjpeg-turbo/libjpeg-turbo_2.1.5-2_copyright",
      png:
        "https://metadata.ftp-master.debian.org/changelogs/main/libp/libpng1.6/libpng1.6_1.6.39-2+deb12u5_copyright",
      poppler:
        "https://metadata.ftp-master.debian.org/changelogs/main/p/poppler/poppler_22.12.0-2+deb12u2_copyright",
    },
    policy: {
      acceptedCompression: "hevc",
      acceptedFrames: 1,
      previewsEnabled: true,
      previewPolicyVersion: 1,
    },
  };
  if (JSON.stringify(dependencies) !== JSON.stringify(expected)) {
    violations.push("worker-image-dependencies.json: exact reviewed dependency policy drifted");
  }

  const dockerfile = readFileSync(dockerfilePath, "utf8");
  const requiredPins = [
    `${expected.baseImage.reference}@${expected.baseImage.digest}`,
    `LIBVIPS_VERSION=${expected.decoder.libvips}`,
    `LIBVIPS_SHA256=f41285b61bfb495605494f074ca341f7791a1d406e2f157dcea606ef1ae1b146`,
    `LIBDE265_VERSION=${expected.decoder.libde265}`,
    `LIBHEIF_VERSION=${expected.decoder.libheif}`,
    `LIBX265_VERSION=${expected.decoder.x265}`,
    `LIBJPEG_VERSION=${expected.renderer.jpeg}`,
    `LIBPNG_VERSION=${expected.renderer.png}`,
    `POPPLER_VERSION=${expected.renderer.popplerUtils}`,
    "libde265-dev=${LIBDE265_VERSION}",
    "libheif-dev=${LIBHEIF_VERSION}",
    "libx265-dev=${LIBX265_VERSION}",
    "libjpeg62-turbo-dev=${LIBJPEG_VERSION}",
    "libpng-dev=${LIBPNG_VERSION}",
    "poppler-utils=${POPPLER_VERSION}",
    "-Djpeg=enabled",
    "-Dpng=enabled",
    "-Dpoppler=disabled",
  ];
  for (const pin of requiredPins) {
    if (!dockerfile.includes(pin)) {
      violations.push(`worker/Dockerfile: missing reviewed pin ${pin}`);
    }
  }

  return violations;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const directory = dirname(path);
    const filename = basename(path);
    throw new Error(`${join(directory, filename)}: ${error.message}`);
  }
}
