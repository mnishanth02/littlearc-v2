import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getConstructionPlans } from "pg-boss";

const output = resolve("../../packages/database/queue-plans/pgboss-v37.sql");
const plan = getConstructionPlans("pgboss")
  .split("\n")
  .map((l) => l.trimEnd())
  .join("\n")
  .trim();
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  `-- Generated from exact pg-boss@12.26.1. Reviewed schema version: 37.\n${plan}\n`,
  "utf8",
);
console.log("Generated reviewed pg-boss v37 construction plan.");
