#!/bin/sh
set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
snapshot_root=$(mktemp -d "${TMPDIR:-/tmp}/littlearc-fnd01.XXXXXX")

cleanup() {
  rm -rf -- "$snapshot_root"
}
trap cleanup EXIT HUP INT TERM

cd "$repository_root"
node tooling/check-toolchain.mjs
pnpm_command=$(command -v pnpm)
node tooling/create-source-snapshot.mjs "$snapshot_root"

cd "$snapshot_root"
"$pnpm_command" install --frozen-lockfile
"$pnpm_command" validate

echo "Clean-checkout validation passed in temporary source-only snapshot"
