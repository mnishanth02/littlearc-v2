import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rename, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const version = "12.3.2";
const expectedSha256 = "44f2c53bf784c0143128d80d2b9946e9793962c5bb403b75c0024cb4d8e346b9";
const url = `https://github.com/qpdf/qpdf/releases/download/v${version}/qpdf-${version}-bin-linux-x86_64.zip`;
const destination = resolve(`.tools/qpdf-${version}`);
const executable = join(destination, "bin/qpdf");

if (process.env.FILE_VALIDATION_ENABLED !== "true") {
  console.log("Skipped QPDF installation because file validation is disabled.");
  process.exit(0);
}
if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error("Enabled file validation requires the reviewed Linux x64 QPDF runtime.");
}

try {
  await stat(executable);
  console.log(`QPDF ${version} is already installed.`);
  process.exit(0);
} catch {
  // Continue with the verified installation.
}

const response = await fetch(url);
if (!response.ok) {
  throw new Error(`QPDF download failed with status ${response.status}.`);
}
const archive = Buffer.from(await response.arrayBuffer());
const observedSha256 = createHash("sha256").update(archive).digest("hex");
if (observedSha256 !== expectedSha256) {
  throw new Error("QPDF archive checksum did not match the reviewed release.");
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "littlearc-qpdf-"));
const archivePath = join(temporaryRoot, "qpdf.zip");
const extractedPath = join(temporaryRoot, "extracted");
await writeFile(archivePath, archive, { mode: 0o600 });
archive.fill(0);
await mkdir(extractedPath, { mode: 0o700 });
await run("unzip", ["-q", archivePath, "-d", extractedPath]);
await mkdir(dirname(destination), { recursive: true });
await rename(extractedPath, destination);
await chmod(executable, 0o755);

const installed = await readFile(executable);
if (installed.length === 0) {
  throw new Error("QPDF installation produced an empty executable.");
}
console.log(`Installed verified QPDF ${version}.`);

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: "ignore",
    });
    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`${command} exited with code ${code}.`));
      }
    });
  });
}
