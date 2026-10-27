// RoadSense cites only the rule corpus. These checks keep every excerpt word
// for word inside the BOE consolidated text it came from, at that text's
// latest version, with explanations in all four languages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

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

const { corpusFrom, rulesByIds, RULE_IDS } = await import("../lib/roadsense/corpus.ts");
const corpus = corpusFrom(JSON.parse(readFileSync(new URL("data/roadsense/corpus.json", ROOT), "utf8")));

const norm = (text: string) => text.replace(/\s+/g, " ").trim();
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** The last <version> element of a stored BOE block. */
function lastVersion(blockId: string): { date: string; xml: string } {
  const xml = readFileSync(new URL(`data/roadsense/boe/${blockId}.xml`, ROOT), "utf8");
  const versions = [...xml.matchAll(/<version\b[^>]*fecha_vigencia="(\d{8})"[^>]*>([\s\S]*?)<\/version>/g)];
  assert.ok(versions.length > 0, `no <version> in ${blockId}`);
  const [, date, body] = versions[versions.length - 1];
  return { date, xml: body };
}

function snapshotText(blockId: string): string {
  return lastVersion(blockId)
    .xml.replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function latestVersionDate(blockId: string): string {
  const { date } = lastVersion(blockId);
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

test("corpus has every rule id once", () => {
  assert.deepEqual(corpus.map((r) => r.id).sort(), [...RULE_IDS].sort());
});

test("excerpts are verbatim in the BOE snapshot", () => {
  for (const r of corpus) assert.ok(norm(snapshotText(r.boeBlockId)).includes(norm(r.excerptEs)), r.id);
});

test("sha256 matches the excerpt", () => {
  for (const r of corpus) assert.equal(r.sha256, sha256(r.excerptEs), r.id);
});

test("every record links its BOE anchor", () => {
  for (const r of corpus) {
    assert.equal(r.boeUrl, `https://www.boe.es/buscar/act.php?id=BOE-A-2003-23514#${r.boeBlockId}`, r.id);
  }
});

test("explanations exist in four languages", () => {
  for (const r of corpus) {
    for (const locale of ["es", "en", "fr", "ar"] as const) {
      assert.ok(r.explanation[locale].trim().length > 20, `${r.id} ${locale}`);
    }
  }
});

test("versionDate is the block's latest BOE version", () => {
  for (const r of corpus) assert.equal(r.versionDate, latestVersionDate(r.boeBlockId), r.id);
});

test("rulesByIds keeps order and rejects unknown ids", () => {
  assert.deepEqual(
    rulesByIds(corpus, ["rgc-69", "rgc-57-1"]).map((r) => r.id),
    ["rgc-69", "rgc-57-1"],
  );
  assert.throws(() => rulesByIds(corpus, ["rgc-999"]));
});

test("corpusFrom rejects a record without an excerpt", () => {
  const [first] = JSON.parse(readFileSync(new URL("data/roadsense/corpus.json", ROOT), "utf8"));
  assert.throws(() => corpusFrom([{ ...first, excerptEs: "" }]), (err: Error) => err.name === "RoadsenseValidationError");
});
