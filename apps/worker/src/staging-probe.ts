import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import { canonicalFileAad, decryptFileContent, encryptFileContent } from "@littlearc/crypto";
import { createUuidV7, filePreviewPolicy } from "@littlearc/domain";
import { createS3EncryptedObjectStorage } from "@littlearc/storage";
import sharp from "sharp";
import { loadWorkerConfig } from "./config.js";
import { createPreviewRenderer } from "./file-preview/renderer.js";
import { createSharpHeicDecoder } from "./file-validation/heic-decoder.js";
import { createParserPermit } from "./file-validation/parser-permit.js";
import { createClamdScanner } from "./scanner/malware-scanner.js";
import { createWorkspaceManager } from "./workspace/workspace.js";

const execFileAsync = promisify(execFile);
const config = loadWorkerConfig();

if (config.appEnv !== "staging" || !config.fileValidation.enabled) {
  throw new Error("The file-validation staging probe requires the enabled staging boundary.");
}
if (!config.uploadStorage) {
  throw new Error("The encrypted preview staging probe requires private object storage.");
}

const qpdfArguments = config.fileValidation.sandboxExecutable
  ? [
      "--no-new-privs",
      "/usr/bin/prlimit",
      "--as=536870912",
      "--cpu=30",
      "--fsize=16777216",
      "--nofile=64",
      "--nproc=8",
      "--",
      config.fileValidation.qpdfExecutable,
      "--version",
    ]
  : ["--version"];
await execFileAsync(
  config.fileValidation.sandboxExecutable ?? config.fileValidation.qpdfExecutable,
  qpdfArguments,
  {
    env: { LANG: "C", PATH: "/usr/bin:/bin" },
    timeout: 10_000,
    windowsHide: true,
  },
);

const heicDecoder = createSharpHeicDecoder({
  ...(config.fileValidation.sandboxExecutable
    ? { sandboxExecutable: config.fileValidation.sandboxExecutable }
    : {}),
});
const heicCapability = await heicDecoder.probe();
if (
  heicCapability.sharp !== "0.34.5" ||
  heicCapability.vips !== "8.17.3" ||
  heicCapability.heif !== "system"
) {
  throw new Error("The staging HEIC decoder dependency set does not match the reviewed image.");
}
const packageVersions = await execFileAsync(
  "/usr/bin/dpkg-query",
  [
    "--show",
    "--showformat=$" + "{Package}=$" + "{Version}\\n",
    "libde265-0",
    "libheif1",
    "libx265-199",
  ],
  {
    encoding: "utf8",
    env: { LANG: "C", PATH: "/usr/bin:/bin" },
    timeout: 10_000,
  },
);
for (const expected of [
  "libde265-0=1.0.11-1+deb12u2",
  "libheif1=1.15.1-1+deb12u1",
  "libx265-199=3.5-2+b1",
]) {
  if (!packageVersions.stdout.split("\n").includes(expected)) {
    throw new Error("The staging HEIC codec packages do not match the reviewed image.");
  }
}

const scanner = createClamdScanner({
  host: config.fileValidation.clamdHost,
  minimumSignatureVersion: config.fileValidation.signatureMinimumVersion,
  port: config.fileValidation.clamdPort,
  signatureMaxAgeHours: config.fileValidation.signatureMaxAgeHours,
  signatureObservedAt: config.fileValidation.signatureObservedAt,
  timeoutMs: 30_000,
});
const scannerReadiness = await scanner.readiness();
if (scannerReadiness.status !== "ready") {
  throw new Error(
    `The private staging scanner readiness failed: ${scannerReadiness.status}; signatureVersion=${scannerReadiness.signatureVersion ?? "unavailable"}.`,
  );
}
const benign = await scanner.scan(Readable.from(Buffer.from("littlearc-vlt05-synthetic")), {
  maxBytes: 1024,
});
if (benign.outcome !== "clean") {
  throw new Error("The synthetic benign scanner probe was not clean.");
}
const eicar = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join(
  "",
);
const detected = await scanner.scan(Readable.from(Buffer.from(eicar)), {
  maxBytes: 1024,
});
if (detected.outcome !== "detected") {
  throw new Error("The synthetic scanner detection probe did not detect the test signature.");
}

const workspace = createWorkspaceManager(config.fileValidation.tmpDir);
await workspace.initialize();
const attemptId = createUuidV7(randomBytes(10));
const heicWorkspace = await workspace.create(attemptId);
await copyFile("/opt/littlearc/synthetic-validation.heic", heicWorkspace.inputPath);
await heicDecoder.decode(heicWorkspace.inputPath);
await workspace.cleanup(attemptId);
if ((await workspace.scavenge(new Date())).length !== 0) {
  throw new Error("The staging probe left a validation workspace behind.");
}

const parserPermit = createParserPermit();
const renderer = createPreviewRenderer({
  parserPermit,
  pdftoppmExecutable: config.fileValidation.pdftoppmExecutable,
  ...(config.fileValidation.sandboxExecutable
    ? { sandboxExecutable: config.fileValidation.sandboxExecutable }
    : {}),
});
const rendererCapability = await renderer.probe();
if (
  rendererCapability.sharp !== "0.34.5" ||
  rendererCapability.vips !== "8.17.3" ||
  rendererCapability.heif !== "system" ||
  !rendererCapability.jpeg ||
  !rendererCapability.png ||
  rendererCapability.poppler !== "22.12.0"
) {
  throw new Error("The staging preview renderer dependency set does not match the reviewed image.");
}
const rendererPackages = await execFileAsync(
  "/usr/bin/dpkg-query",
  [
    "--show",
    "--showformat=$" + "{Package}=$" + "{Version}\\n",
    "libjpeg62-turbo",
    "libpng16-16",
    "poppler-utils",
  ],
  {
    encoding: "utf8",
    env: { LANG: "C", PATH: "/usr/bin:/bin" },
    timeout: 10_000,
  },
);
for (const expected of [
  "libjpeg62-turbo=1:2.1.5-2",
  "libpng16-16=1.6.39-2+deb12u5",
  "poppler-utils=22.12.0-2+deb12u2",
]) {
  if (!rendererPackages.stdout.split("\n").includes(expected)) {
    throw new Error("The staging preview codec packages do not match the reviewed image.");
  }
}

const rendered = new Map<string, Buffer>();
for (const fixture of [
  { mime: "image/jpeg" as const, name: "jpeg" },
  { mime: "image/png" as const, name: "png" },
  { mime: "image/heic" as const, name: "heic" },
  { mime: "application/pdf" as const, name: "pdf" },
  { mime: "application/pdf" as const, name: "pdf-annotation" },
]) {
  const renderAttemptId = createUuidV7(randomBytes(10));
  const renderWorkspace = await workspace.create(renderAttemptId);
  try {
    if (fixture.name === "heic") {
      await copyFile("/opt/littlearc/synthetic-validation.heic", renderWorkspace.inputPath);
    } else if (fixture.name === "pdf" || fixture.name === "pdf-annotation") {
      await writeFile(renderWorkspace.inputPath, syntheticPdf(fixture.name === "pdf-annotation"), {
        mode: 0o600,
      });
    } else {
      const image = sharp({
        create: {
          background:
            fixture.name === "png"
              ? { alpha: 0.5, b: 180, g: 120, r: 40 }
              : { alpha: 1, b: 40, g: 120, r: 180 },
          channels: 4,
          height: 1800,
          width: 2400,
        },
      });
      if (fixture.name === "png") {
        await image
          .png()
          .withMetadata({ exif: { IFD0: { ImageDescription: "PREVIEW_METADATA_CANARY" } } })
          .toFile(renderWorkspace.inputPath);
      } else {
        await image
          .jpeg()
          .withMetadata({ exif: { IFD0: { ImageDescription: "PREVIEW_METADATA_CANARY" } } })
          .toFile(renderWorkspace.inputPath);
      }
    }
    const result = await renderer.render({
      inputPath: renderWorkspace.inputPath,
      intermediatePath: renderWorkspace.renderIntermediatePath,
      outputPath: renderWorkspace.previewPlaintextPartPath,
      sourceMime: fixture.mime,
    });
    if (
      result.bytes > filePreviewPolicy.maxPlaintextBytes ||
      result.width > filePreviewPolicy.maxDimension ||
      result.height > filePreviewPolicy.maxDimension
    ) {
      throw new Error("The staging preview output exceeded the reviewed bounds.");
    }
    const previewBytes = await readFile(renderWorkspace.previewPlaintextPartPath);
    if (previewBytes.includes(Buffer.from("PREVIEW_METADATA_CANARY"))) {
      throw new Error("The staging preview retained a metadata canary.");
    }
    const scan = await scanner.scan(Readable.from(previewBytes), {
      maxBytes: filePreviewPolicy.maxPlaintextBytes,
    });
    if (scan.outcome !== "clean") {
      throw new Error("The staging preview scanner probe was not clean.");
    }
    rendered.set(fixture.name, previewBytes);
  } finally {
    await workspace.cleanup(renderAttemptId);
  }
}
if (!rendered.get("pdf")?.equals(rendered.get("pdf-annotation") ?? Buffer.alloc(0))) {
  throw new Error("The staging PDF preview did not hide the synthetic annotation.");
}

const providerAttemptId = createUuidV7(randomBytes(10));
const providerDerivativeId = createUuidV7(randomBytes(10));
const providerSourceId = createUuidV7(randomBytes(10));
const providerWorkspace = await workspace.create(providerAttemptId);
const providerKey = randomBytes(32);
const providerObjectKey = `derivatives/${providerDerivativeId}/${providerAttemptId}.lac`;
const storage = createS3EncryptedObjectStorage({
  accessKeyId: config.uploadStorage.accessKeyId,
  bucket: config.uploadStorage.bucket,
  endpoint: config.uploadStorage.endpoint,
  region: config.uploadStorage.region,
  secretAccessKey: config.uploadStorage.secretAccessKey,
});
try {
  const preview = rendered.get("jpeg");
  if (!preview) {
    throw new Error("The staging provider probe had no synthetic preview.");
  }
  await writeFile(providerWorkspace.previewPlaintextPartPath, preview, { mode: 0o600 });
  const aad = canonicalFileAad({
    aadSchemaVersion: 1,
    derivativeId: providerDerivativeId,
    format: "image/jpeg",
    previewPolicyVersion: 1,
    purpose: "validation-preview",
    sourceObjectId: providerSourceId,
  });
  const encrypted = await encryptFileContent({
    aad,
    ciphertext: createWriteStream(providerWorkspace.previewCiphertextPartPath, {
      flags: "wx",
      mode: 0o600,
    }),
    fileKey: providerKey,
    plaintext: createReadStream(providerWorkspace.previewPlaintextPartPath),
  });
  const localHash = await sha256File(providerWorkspace.previewCiphertextPartPath);
  const uploaded = await storage.writeEncryptedObject({
    objectKey: providerObjectKey,
    path: providerWorkspace.previewCiphertextPartPath,
  });
  if (uploaded.bytes !== localHash.bytes || uploaded.sha256 !== localHash.sha256) {
    throw new Error("The staging encrypted preview provider hash did not match.");
  }
  await decryptFileContent({
    aad,
    authTag: encrypted.authTag,
    ciphertext: await storage.readObjectStream(providerObjectKey),
    fileKey: providerKey,
    nonce: encrypted.nonce,
    plaintext: createWriteStream(providerWorkspace.inputPartPath, { flags: "wx", mode: 0o600 }),
  });
  if (!(await readFile(providerWorkspace.inputPartPath)).equals(preview)) {
    throw new Error("The staging encrypted preview did not authenticate after download.");
  }
} finally {
  providerKey.fill(0);
  await storage.deleteObject(providerObjectKey);
  await workspace.cleanup(providerAttemptId);
}
if ((await workspace.scavenge(new Date())).length !== 0) {
  throw new Error("The staging preview probe left an opaque workspace behind.");
}

console.log(
  `VLT-05-F3 staging probe passed: exact bounded renderers, synthetic format matrix, metadata and annotation controls, encrypted private-provider round trip, fresh scanner, previews ${config.fileValidation.previewsEnabled ? "enabled" : "disabled"}, and workspace cleanup.`,
);

async function sha256File(
  path: string,
): Promise<{ readonly bytes: number; readonly sha256: string }> {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    bytes += Buffer.byteLength(chunk);
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest("hex") };
}

function syntheticPdf(annotation: boolean): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R${annotation ? " /Annots [6 0 R]" : ""} >>`,
    "<< /Length 54 >>\nstream\nBT /F1 18 Tf 40 110 Td (SYNTHETIC PREVIEW) Tj ET\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Annot /Subtype /Text /Rect [220 120 250 150] /Contents (HIDDEN ANNOTATION) >>",
  ];
  const header = "%PDF-1.4\n";
  let body = header;
  const offsets = [0];
  const count = annotation ? 6 : 5;
  for (let index = 0; index < count; index += 1) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= count; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}
