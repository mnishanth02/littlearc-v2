import { execFileSync } from "node:child_process";

const expectedNode = "24.18.0";
const expectedPnpm = "11.14.0";
const observedNode = process.versions.node;
const observedPnpm = execFileSync("pnpm", ["--version"], {
  encoding: "utf8",
}).trim();

const mismatches = [];

if (observedNode !== expectedNode) {
  mismatches.push(`Node.js ${expectedNode} required; observed ${observedNode}`);
}

if (observedPnpm !== expectedPnpm) {
  mismatches.push(`pnpm ${expectedPnpm} required; observed ${observedPnpm}`);
}

if (mismatches.length > 0) {
  for (const mismatch of mismatches) {
    console.error(`toolchain_mismatch: ${mismatch}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Toolchain verified: Node.js ${observedNode}, pnpm ${observedPnpm}`);
}
