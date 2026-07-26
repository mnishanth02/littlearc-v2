import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { canonicalFileAad, decryptFileContent, encryptFileContent } from "@littlearc/crypto";
import { createUuidV7, filePreviewPolicy } from "@littlearc/domain";
import { createMemoryEncryptedObjectStorage } from "@littlearc/storage";
import sharp from "sharp";
import { createPreviewRenderer } from "../file-preview/renderer.js";
import { createParserPermit } from "../file-validation/parser-permit.js";

const execFileAsync = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "littlearc-preview-integration-"));
const renderer = createPreviewRenderer({
  parserPermit: createParserPermit(),
  pdftoppmExecutable: "/usr/local/bin/pdftoppm",
});

try {
  const capability = await renderer.probe();
  if (!capability.jpeg || !capability.png) {
    throw new Error("The local preview codecs are unavailable.");
  }
  const sourcePng = join(root, "source.png");
  const sourceJpeg = join(root, "source.jpeg");
  const sourceHeic = join(root, "source.heic");
  const sourcePdf = join(root, "source.pdf");
  const image = sharp({
    create: {
      background: { alpha: 0.4, b: 140, g: 90, r: 30 },
      channels: 4,
      height: 1800,
      width: 2400,
    },
  });
  await image
    .clone()
    .png()
    .withMetadata({ exif: { IFD0: { ImageDescription: "LOCAL_PREVIEW_CANARY" } } })
    .toFile(sourcePng);
  await image
    .clone()
    .jpeg()
    .withMetadata({ exif: { IFD0: { ImageDescription: "LOCAL_PREVIEW_CANARY" } } })
    .toFile(sourceJpeg);
  await execFileAsync("vips", ["copy", sourcePng, `${sourceHeic}[compression=hevc,lossless=true]`]);
  await writeFile(sourcePdf, syntheticPdf(), { mode: 0o600 });

  let retainedPreview: Buffer | undefined;
  for (const fixture of [
    { mime: "image/jpeg" as const, path: sourceJpeg },
    { mime: "image/png" as const, path: sourcePng },
    { mime: "image/heic" as const, path: sourceHeic },
    { mime: "application/pdf" as const, path: sourcePdf },
  ]) {
    const outputPath = join(root, `${fixture.mime.replaceAll("/", "-")}.out`);
    const result = await renderer.render({
      inputPath: fixture.path,
      intermediatePath: join(root, `${fixture.mime.replaceAll("/", "-")}.intermediate`),
      outputPath,
      sourceMime: fixture.mime,
    });
    const bytes = await readFile(outputPath);
    if (
      result.bytes > filePreviewPolicy.maxPlaintextBytes ||
      result.width > filePreviewPolicy.maxDimension ||
      result.height > filePreviewPolicy.maxDimension ||
      bytes.includes(Buffer.from("LOCAL_PREVIEW_CANARY"))
    ) {
      throw new Error("The local preview output violated its bounded metadata-free policy.");
    }
    retainedPreview ??= bytes;
  }

  if (!retainedPreview) {
    throw new Error("The local preview integration produced no output.");
  }
  const derivativeId = createUuidV7(randomBytes(10));
  const attemptId = createUuidV7(randomBytes(10));
  const sourceObjectId = createUuidV7(randomBytes(10));
  const key = randomBytes(32);
  const plaintextPath = join(root, "preview-plaintext.part");
  const ciphertextPath = join(root, "preview-ciphertext.part");
  const decryptedPath = join(root, "preview-decrypted.part");
  const objectKey = `derivatives/${derivativeId}/${attemptId}.lac`;
  const aad = canonicalFileAad({
    aadSchemaVersion: 1,
    derivativeId,
    format: "image/jpeg",
    previewPolicyVersion: 1,
    purpose: "validation-preview",
    sourceObjectId,
  });
  const storage = createMemoryEncryptedObjectStorage();
  try {
    await writeFile(plaintextPath, retainedPreview, { mode: 0o600 });
    const encrypted = await encryptFileContent({
      aad,
      ciphertext: createWriteStream(ciphertextPath, { flags: "wx", mode: 0o600 }),
      fileKey: key,
      plaintext: createReadStream(plaintextPath),
    });
    const uploaded = await storage.writeEncryptedObject({ objectKey, path: ciphertextPath });
    const observed = await storage.hashObject(objectKey);
    if (
      uploaded.bytes !== observed.bytes ||
      uploaded.sha256 !== observed.sha256 ||
      uploaded.sha256 !==
        createHash("sha256")
          .update(await readFile(ciphertextPath))
          .digest("hex")
    ) {
      throw new Error("The local encrypted preview storage digest did not match.");
    }
    await decryptFileContent({
      aad,
      authTag: encrypted.authTag,
      ciphertext: await storage.readObjectStream(objectKey),
      fileKey: key,
      nonce: encrypted.nonce,
      plaintext: createWriteStream(decryptedPath, { flags: "wx", mode: 0o600 }),
    });
    if (!(await readFile(decryptedPath)).equals(retainedPreview)) {
      throw new Error("The local encrypted preview did not authenticate after download.");
    }
    await storage.deleteObject(objectKey);
    await expectMissing(storage.headObject(objectKey));
  } finally {
    key.fill(0);
  }

  console.log(
    "VLT-05-F3 local preview integration passed: synthetic JPEG/PNG/HEIC/PDF rendering, bounds, metadata stripping, fresh encryption, opaque storage round trip, authenticated decrypt, delete, and cleanup.",
  );
} finally {
  await rm(root, { force: true, recursive: true });
}

async function expectMissing(result: Promise<unknown>): Promise<void> {
  try {
    await result;
  } catch {
    return;
  }
  throw new Error("Expected the encrypted derivative candidate to be absent.");
}

function syntheticPdf(): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    "<< /Length 54 >>\nstream\nBT /F1 18 Tf 40 110 Td (SYNTHETIC PREVIEW) Tj ET\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}
