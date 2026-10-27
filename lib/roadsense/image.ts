import { RoadsenseValidationError } from "./errors";

// Learner photos are analysed in memory and never stored. Before one is sent to
// the model, its metadata (EXIF with GPS, XMP, comments, text chunks) is removed
// here without decoding the image: only whole metadata blocks are dropped.

export type ImageType = "jpeg" | "png" | "webp";

/** Raw image bytes; Vercel caps request bodies at 4.5 MB and base64 adds a third. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

const MIME: Record<ImageType, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_METADATA = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
const WEBP_METADATA = new Set(["EXIF", "XMP "]);
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

function invalid(type: ImageType): never {
  throw new RoadsenseValidationError(`not a valid ${type.toUpperCase()} file`);
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/** Decodes base64, with or without a data-URL prefix. */
export function decodeBase64Image(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;,]+;base64,/, "").replace(/\s+/g, "");
  if (clean === "" || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    throw new RoadsenseValidationError("image is not valid base64");
  }
  return Uint8Array.from(atob(clean), (char) => char.charCodeAt(0));
}

/** The file type from its magic bytes; HEIC, GIF and everything else is null. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && PNG_SIGNATURE.every((value, i) => bytes[i] === value)) return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  return null;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Drops APP1-APP15 and COM segments before the image data; the scan data is copied untouched. */
function stripJpeg(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff || offset + 1 >= bytes.length) invalid("jpeg");
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    if (marker === 0xda || marker === 0xd9) {
      kept.push(bytes.subarray(offset)); // start of scan or end of image: the rest is image data
      return concat(kept);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) invalid("jpeg");
    const end = offset + 2 + ((bytes[offset + 2] << 8) | bytes[offset + 3]);
    if (end > bytes.length) invalid("jpeg");
    const metadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!metadata) kept.push(bytes.subarray(offset, end));
    offset = end;
  }
  invalid("jpeg");
}

/** Drops metadata chunks and keeps every other chunk byte for byte, CRC included. */
function stripPng(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (end > bytes.length) invalid("png");
    if (!PNG_METADATA.has(type)) kept.push(bytes.subarray(offset, end));
    offset = end;
    if (type === "IEND") return concat(kept);
  }
  invalid("png");
}

/** Drops EXIF and XMP chunks, clears their VP8X flags and rewrites the RIFF size. */
function stripWebp(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourcc = ascii(bytes, offset, 4);
    const size = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | ((bytes[offset + 7] << 24) >>> 0);
    const end = offset + 8 + size + (size % 2);
    if (end > bytes.length) invalid("webp");
    if (!WEBP_METADATA.has(fourcc)) {
      const chunk = bytes.slice(offset, end);
      if (fourcc === "VP8X" && size >= 1) chunk[8] &= ~(VP8X_EXIF | VP8X_XMP) & 0xff;
      kept.push(chunk);
    }
    offset = end;
  }
  if (offset !== bytes.length) invalid("webp");
  const body = concat(kept);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 4), 0);
  const riffSize = body.length + 4;
  header.set([riffSize & 0xff, (riffSize >> 8) & 0xff, (riffSize >> 16) & 0xff, (riffSize >>> 24) & 0xff], 4);
  header.set(bytes.subarray(8, 12), 8);
  return concat([header, body]);
}

/** The same image without its metadata blocks. Malformed files throw RoadsenseValidationError. */
export function stripImageMetadata(bytes: Uint8Array, type: ImageType): Uint8Array {
  if (type === "jpeg") return stripJpeg(bytes);
  if (type === "png") return stripPng(bytes);
  return stripWebp(bytes);
}

export function toDataUrl(bytes: Uint8Array, type: ImageType): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${MIME[type]};base64,${btoa(binary)}`;
}
