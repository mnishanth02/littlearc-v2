import { inspectMobileReleaseBundle } from "./policy.mjs";

const bundleRoots = process.argv.slice(2);
if (bundleRoots.length === 0) {
  throw new Error("Provide at least one mobile release bundle directory.");
}

for (const bundleRoot of bundleRoots) {
  const result = inspectMobileReleaseBundle(bundleRoot);
  if (result.leaks.length > 0) {
    const details = result.leaks
      .map(({ canary, file }) => `- ${JSON.stringify(canary)} in ${file}`)
      .join("\n");
    throw new Error(`Development validation content reached ${bundleRoot}:\n${details}`);
  }

  console.log(
    `Mobile release bundle validation passed: ${bundleRoot} (${result.filesInspected} files).`,
  );
}
