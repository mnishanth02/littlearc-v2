import { open, stat } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { type FileValidationSafeErrorCode, fileValidationLimits } from "@littlearc/domain";
import { fileTypeFromFile } from "file-type";

export type AcceptedMime = "application/pdf" | "image/heic" | "image/jpeg" | "image/png";

export type StructureResult = {
  readonly detectedMime: AcceptedMime;
  readonly pageCount: number | null;
};

export type PdfInspector = {
  readonly inspect: (path: string, signal?: AbortSignal) => Promise<{ readonly pageCount: number }>;
};

export class FileValidationError extends Error {
  readonly code: FileValidationSafeErrorCode;
  readonly retryable: boolean;

  constructor(code: FileValidationSafeErrorCode, retryable = false) {
    super("File validation failed.");
    this.name = "FileValidationError";
    this.code = code;
    this.retryable = retryable;
  }
}

export async function validateFileStructure(input: {
  readonly declaredMime: AcceptedMime;
  readonly path: string;
  readonly pdfInspector: PdfInspector;
  readonly signal?: AbortSignal;
}): Promise<StructureResult> {
  input.signal?.throwIfAborted();
  const file = await stat(input.path);
  if (file.size < 1 || file.size > fileValidationLimits.maxPlaintextBytes) {
    throw new FileValidationError("resource_limit_exceeded");
  }
  let detected: Awaited<ReturnType<typeof fileTypeFromFile>>;
  try {
    detected = await fileTypeFromFile(input.path);
  } catch {
    throw new FileValidationError("malformed_structure");
  }
  const detectedMime = normalizeDetectedMime(detected?.mime);
  if (!detectedMime) {
    throw new FileValidationError("unsupported_format");
  }
  if (detectedMime !== input.declaredMime) {
    throw new FileValidationError("type_mismatch");
  }
  if (detectedMime === "image/png") {
    await validatePng(input.path, input.signal);
    return { detectedMime, pageCount: null };
  }
  if (detectedMime === "image/jpeg") {
    await validateJpeg(input.path, input.signal);
    return { detectedMime, pageCount: null };
  }
  if (detectedMime === "image/heic") {
    await validateHeif(input.path, input.signal);
    return { detectedMime, pageCount: null };
  }
  const pdf = await input.pdfInspector.inspect(input.path, input.signal);
  return { detectedMime, pageCount: pdf.pageCount };
}

function normalizeDetectedMime(value: string | undefined): AcceptedMime | null {
  if (value === "image/heif" || value === "image/heic") {
    return "image/heic";
  }
  if (value === "image/jpeg" || value === "image/png" || value === "application/pdf") {
    return value;
  }
  return null;
}

async function validatePng(path: string, signal?: AbortSignal): Promise<void> {
  const handle = await open(path, "r");
  try {
    const size = (await handle.stat()).size;
    let offset = 8;
    let sawHeader = false;
    let sawData = false;
    let sawEnd = false;
    let expectedDecodedBytes: number | undefined;
    const compressedData: Buffer[] = [];
    while (offset < size) {
      signal?.throwIfAborted();
      const header = await readExact(handle, offset, 8);
      const length = header.readUInt32BE(0);
      const type = header.toString("ascii", 4, 8);
      if (length > fileValidationLimits.maxPlaintextBytes || offset + 12 + length > size) {
        throw new FileValidationError("malformed_structure");
      }
      const payload = await readExact(handle, offset + 8, length);
      const crc = (await readExact(handle, offset + 8 + length, 4)).readUInt32BE(0);
      if (crc32(Buffer.concat([header.subarray(4), payload])) !== crc) {
        throw new FileValidationError("malformed_structure");
      }
      if (!sawHeader) {
        if (type !== "IHDR" || length !== 13) {
          throw new FileValidationError("malformed_structure");
        }
        const width = payload.readUInt32BE(0);
        const height = payload.readUInt32BE(4);
        assertImageBounds(width, height);
        const bitDepth = payload[8];
        const colorType = payload[9];
        const channels =
          colorType === 0
            ? 1
            : colorType === 2
              ? 3
              : colorType === 3
                ? 1
                : colorType === 4
                  ? 2
                  : colorType === 6
                    ? 4
                    : 0;
        const validDepth =
          (colorType === 0 && [1, 2, 4, 8, 16].includes(bitDepth ?? 0)) ||
          (colorType === 2 && [8, 16].includes(bitDepth ?? 0)) ||
          (colorType === 3 && [1, 2, 4, 8].includes(bitDepth ?? 0)) ||
          (colorType === 4 && [8, 16].includes(bitDepth ?? 0)) ||
          (colorType === 6 && [8, 16].includes(bitDepth ?? 0));
        if (
          channels === 0 ||
          !validDepth ||
          payload[10] !== 0 ||
          payload[11] !== 0 ||
          payload[12] !== 0
        ) {
          throw new FileValidationError("unsupported_format");
        }
        expectedDecodedBytes = height * (1 + Math.ceil((width * channels * (bitDepth ?? 0)) / 8));
        sawHeader = true;
      } else if (type === "IHDR") {
        throw new FileValidationError("malformed_structure");
      }
      if (type === "IDAT") {
        sawData = true;
        compressedData.push(payload);
      } else if (sawData && type !== "IEND") {
        throw new FileValidationError("malformed_structure");
      }
      if (type === "acTL") {
        throw new FileValidationError("unsupported_format");
      }
      if (isCriticalPngChunk(type) && !["IHDR", "PLTE", "IDAT", "IEND"].includes(type)) {
        throw new FileValidationError("unsupported_format");
      }
      offset += 12 + length;
      if (type === "IEND") {
        if (length !== 0 || offset !== size) {
          throw new FileValidationError("malformed_structure");
        }
        sawEnd = true;
        break;
      }
    }
    if (!sawHeader || !sawData || !sawEnd || expectedDecodedBytes === undefined) {
      throw new FileValidationError("malformed_structure");
    }
    let decoded: Buffer;
    try {
      decoded = inflateSync(Buffer.concat(compressedData), {
        maxOutputLength: expectedDecodedBytes + 1,
      });
    } catch {
      throw new FileValidationError("malformed_structure");
    }
    if (decoded.length !== expectedDecodedBytes) {
      decoded.fill(0);
      throw new FileValidationError("malformed_structure");
    }
    decoded.fill(0);
  } finally {
    await handle.close();
  }
}

async function validateJpeg(path: string, signal?: AbortSignal): Promise<void> {
  const handle = await open(path, "r");
  try {
    const size = (await handle.stat()).size;
    const bytes = await readExact(handle, 0, size);
    if (size < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      throw new FileValidationError("malformed_structure");
    }
    let offset = 2;
    let sawFrame = false;
    let sawEnd = false;
    while (offset < size) {
      signal?.throwIfAborted();
      if (bytes[offset] !== 0xff) {
        throw new FileValidationError("malformed_structure");
      }
      while (bytes[offset] === 0xff) {
        offset += 1;
      }
      const marker = bytes[offset];
      offset += 1;
      if (marker === 0xd9) {
        if (offset !== size) {
          throw new FileValidationError("malformed_structure");
        }
        sawEnd = true;
        break;
      }
      if (marker === 0xda) {
        const length = segmentLength(bytes, offset, size);
        offset += length;
        while (offset < size - 1) {
          if (bytes[offset] !== 0xff) {
            offset += 1;
            continue;
          }
          const next = bytes[offset + 1];
          if (next === 0x00 || (next !== undefined && next >= 0xd0 && next <= 0xd7)) {
            offset += 2;
            continue;
          }
          break;
        }
        continue;
      }
      if (marker === undefined || marker === 0x00 || marker === 0xd8) {
        throw new FileValidationError("malformed_structure");
      }
      const length = segmentLength(bytes, offset, size);
      if (isStartOfFrame(marker)) {
        if (sawFrame || length < 8) {
          throw new FileValidationError("malformed_structure");
        }
        assertImageBounds(bytes.readUInt16BE(offset + 3), bytes.readUInt16BE(offset + 5));
        sawFrame = true;
      }
      offset += length;
    }
    if (!sawFrame || !sawEnd) {
      throw new FileValidationError("malformed_structure");
    }
  } finally {
    await handle.close();
  }
}

async function validateHeif(path: string, signal?: AbortSignal): Promise<void> {
  const handle = await open(path, "r");
  try {
    const size = (await handle.stat()).size;
    let offset = 0;
    let sawFtyp = false;
    let acceptedBrand = false;
    while (offset < size) {
      signal?.throwIfAborted();
      const header = await readExact(handle, offset, 8);
      let boxSize = header.readUInt32BE(0);
      const type = header.toString("ascii", 4, 8);
      let headerBytes = 8;
      if (boxSize === 1) {
        const extended = await readExact(handle, offset + 8, 8);
        const value = extended.readBigUInt64BE(0);
        if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new FileValidationError("resource_limit_exceeded");
        }
        boxSize = Number(value);
        headerBytes = 16;
      } else if (boxSize === 0) {
        boxSize = size - offset;
      }
      if (boxSize < headerBytes || offset + boxSize > size) {
        throw new FileValidationError("malformed_structure");
      }
      if (type === "ftyp") {
        if (sawFtyp || offset !== 0 || boxSize < headerBytes + 8) {
          throw new FileValidationError("malformed_structure");
        }
        const brands = await readExact(handle, offset + headerBytes, boxSize - headerBytes);
        const observed: string[] = [];
        observed.push(brands.toString("ascii", 0, 4));
        for (let brandOffset = 8; brandOffset + 4 <= brands.length; brandOffset += 4) {
          observed.push(brands.toString("ascii", brandOffset, brandOffset + 4));
        }
        if (observed.some((brand) => ["avif", "avis", "hevc", "hevx", "msf1"].includes(brand))) {
          throw new FileValidationError("unsupported_format");
        }
        acceptedBrand = observed.some((brand) => ["heic", "heix", "mif1"].includes(brand));
        sawFtyp = true;
      }
      offset += boxSize;
    }
    if (!sawFtyp || !acceptedBrand || offset !== size) {
      throw new FileValidationError("malformed_structure");
    }
    // A valid ISO-BMFF envelope is not proof that the HEVC image item decodes
    // safely. VLT-05 keeps HEIC fail-closed until a separately reviewed,
    // resource-bounded decoder is present in the deployed worker image.
    throw new FileValidationError("unsupported_format");
  } finally {
    await handle.close();
  }
}

function segmentLength(bytes: Buffer, offset: number, size: number): number {
  if (offset + 2 > size) {
    throw new FileValidationError("malformed_structure");
  }
  const length = bytes.readUInt16BE(offset);
  if (length < 2 || offset + length > size) {
    throw new FileValidationError("malformed_structure");
  }
  return length;
}

function isStartOfFrame(marker: number): boolean {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
    marker,
  );
}

function assertImageBounds(width: number, height: number): void {
  if (
    width < 1 ||
    height < 1 ||
    width > fileValidationLimits.maxImageDimension ||
    height > fileValidationLimits.maxImageDimension ||
    width * height > fileValidationLimits.maxImagePixels
  ) {
    throw new FileValidationError("resource_limit_exceeded");
  }
}

function isCriticalPngChunk(type: string): boolean {
  const first = type.charCodeAt(0);
  return first >= 65 && first <= 90;
}

async function readExact(
  handle: Awaited<ReturnType<typeof open>>,
  position: number,
  length: number,
): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  const result = await handle.read(buffer, 0, length, position);
  if (result.bytesRead !== length) {
    throw new FileValidationError("malformed_structure");
  }
  return buffer;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
