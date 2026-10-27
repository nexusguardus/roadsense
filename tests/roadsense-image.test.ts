// Learner photos go to Meta for analysis but never with their metadata (GPS,
// camera, time). These checks build tiny JPEG, PNG and WebP files byte by byte
// and make sure only the metadata blocks disappear.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { crc32 } from "node:zlib";

// lib/ and components/ import through the "@/" alias and without extensions.
const ROOT = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    try {
      return nextResolve(target, context);
    } catch (err) {
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) throw err;
      return nextResolve(`${target}.ts`, context);
    }
  },
});

const { MAX_UPLOAD_BYTES, decodeBase64Image, sniffImageType, stripImageMetadata, toDataUrl } = await import("../lib/roadsense/image.ts");
const { RoadsenseValidationError } = await import("../lib/roadsense/errors.ts");

const bytes = (...parts: (number[] | string | Uint8Array)[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p, "latin1")] : [...p])));
const has = (haystack: Uint8Array, needle: string) => Buffer.from(haystack).includes(Buffer.from(needle, "latin1"));

// JPEG: SOI, APP0 (JFIF), APP1 (Exif), COM, DQT, SOS + scan data, EOI.
const APP0 = bytes([0xff, 0xe0, 0x00, 0x10], "JFIF\0", [1, 1, 0, 0, 1, 0, 1, 0, 0]);
const APP1 = bytes([0xff, 0xe1, 0x00, 0x0e], "Exif\0\0GPS!xx");
const COM = bytes([0xff, 0xfe, 0x00, 0x05], "abc");
const DQT = bytes([0xff, 0xdb, 0x00, 0x04, 0x00, 0x00]);
const SCAN = bytes([0xff, 0xda, 0x00, 0x04, 0x00, 0x00, 0x11, 0x22, 0x33, 0xff, 0xd9]);
const JPEG = bytes([0xff, 0xd8], APP0, APP1, COM, DQT, SCAN);

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const body = bytes(type, data);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  Buffer.from(body).copy(out, 4);
  out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
  return new Uint8Array(out);
}
const PNG_SIG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR = pngChunk("IHDR", bytes([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
const IDAT = pngChunk("IDAT", bytes([0x78, 0x01]));
const IEND = pngChunk("IEND", new Uint8Array());
const PNG = bytes(PNG_SIG, IHDR, pngChunk("tEXt", bytes("Comment\0secret")), pngChunk("eXIf", bytes("MM\0*")), IDAT, IEND);

function webpChunk(fourcc: string, data: Uint8Array): Uint8Array {
  const pad = data.length % 2;
  const out = Buffer.alloc(8 + data.length + pad);
  out.write(fourcc, 0, "latin1");
  out.writeUInt32LE(data.length, 4);
  Buffer.from(data).copy(out, 8);
  return new Uint8Array(out);
}
function webp(...chunks: Uint8Array[]): Uint8Array {
  const body = bytes("WEBP", ...chunks);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(body.length, 4);
  return bytes(header, body);
}
// VP8X flags: 0x08 = EXIF present, 0x04 = XMP present.
const VP8X = (flags: number) => webpChunk("VP8X", bytes([flags, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
const VP8 = webpChunk("VP8 ", bytes([1, 2, 3, 4]));
const WEBP = webp(VP8X(0x0c), VP8, webpChunk("EXIF", bytes("Exif\0\0")), webpChunk("XMP ", bytes("<x:xmp/>")));

test("sniffs jpeg, png and webp and rejects heic and gif", () => {
  assert.equal(sniffImageType(JPEG), "jpeg");
  assert.equal(sniffImageType(PNG), "png");
  assert.equal(sniffImageType(WEBP), "webp");
  assert.equal(sniffImageType(bytes([0, 0, 0, 0x18], "ftypheic", [0, 0, 0, 0])), null);
  assert.equal(sniffImageType(bytes("GIF89a", [1, 0, 1, 0])), null);
});

test("jpeg loses its Exif and comment segments and keeps the image data", () => {
  const stripped = stripImageMetadata(JPEG, "jpeg");
  assert.deepEqual(stripped, bytes([0xff, 0xd8], APP0, DQT, SCAN));
  assert.equal(has(stripped, "GPS!"), false);
});

test("png loses text and Exif chunks and keeps IHDR, IDAT and IEND", () => {
  assert.deepEqual(stripImageMetadata(PNG, "png"), bytes(PNG_SIG, IHDR, IDAT, IEND));
});

test("webp loses EXIF and XMP and fixes the RIFF size and VP8X flags", () => {
  assert.deepEqual(stripImageMetadata(WEBP, "webp"), webp(VP8X(0x00), VP8));
});

test("a truncated jpeg is rejected", () => {
  assert.throws(() => stripImageMetadata(bytes([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40, 0x01]), "jpeg"), RoadsenseValidationError);
});

test("invalid base64 is rejected", () => {
  assert.throws(() => decodeBase64Image("%%%not base64"), RoadsenseValidationError);
  assert.throws(() => decodeBase64Image(""), RoadsenseValidationError);
});

test("base64 round-trips through a data URL", () => {
  const url = toDataUrl(PNG, "png");
  assert.ok(url.startsWith("data:image/png;base64,"));
  assert.deepEqual(decodeBase64Image(url), PNG);
});

test("uploads are capped at 3 MB", () => {
  assert.equal(MAX_UPLOAD_BYTES, 3 * 1024 * 1024);
});
