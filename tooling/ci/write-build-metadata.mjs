import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";
import { createBuildMetadata } from "./build-metadata.mjs";

const output = process.env.LITTLEARC_CI_OUTPUT ?? ".artifacts/ci/build-metadata.json";
const pnpmVersion = execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim();
const metadata = createBuildMetadata({ environment: process.env, pnpmVersion });

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(metadata, null, 2) + "\n", { mode: 0o600 });
console.log("Wrote CI source metadata to " + output + ".");
