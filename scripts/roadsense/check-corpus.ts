// Checks every excerpt in data/roadsense/corpus.json against the current BOE
// consolidated text of the Reglamento General de Circulación (BOE-A-2003-23514).
//
//   npx tsx scripts/roadsense/check-corpus.ts                    compare with the live BOE, exit 1 on any mismatch
//   npx tsx scripts/roadsense/check-corpus.ts --update-snapshot  store the live blocks in data/roadsense/boe/
//   npx tsx scripts/roadsense/check-corpus.ts --print <blockId>  print a block's latest text (for writing excerpts)
//
// The BOE open-data API answers 400 to a JSON Accept header, so blocks are read as XML.
// Run from the repo root: tsx loads this file as CommonJS (no top-level await, no import.meta).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LAW = "BOE-A-2003-23514";
const API = `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${LAW}/texto/bloque/`;
const CORPUS = resolve("data/roadsense/corpus.json");
const SNAPSHOTS = resolve("data/roadsense/boe");
/** Blocks the corpus draws on: arts. 56-59, 65, 67, 69, 133, 145, Anexo I §4 (lights) and §5 (signs and markings). */
const DEFAULT_BLOCKS = ["a56", "a57", "a58", "a59", "a65", "a67", "a69", "a133", "a145", "A4", "A5"];

interface CorpusRecord {
  id: string;
  boeBlockId: string;
  excerptEs: string;
  versionDate: string;
}

/** The last <version> element: the text currently in force for that block. */
function lastVersion(xml: string): { date: string; body: string } {
  const versions = [...xml.matchAll(/<version\b[^>]*fecha_vigencia="(\d{8})"[^>]*>([\s\S]*?)<\/version>/g)];
  if (versions.length === 0) throw new Error("no <version> element in the BOE response");
  const [, raw, body] = versions[versions.length - 1];
  return { date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`, body };
}

function plainText(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const norm = (text: string): string => text.replace(/\s+/g, " ").trim();

async function fetchBlock(blockId: string): Promise<string> {
  const res = await fetch(API + encodeURIComponent(blockId), { headers: { Accept: "application/xml" } });
  if (!res.ok) throw new Error(`BOE ${blockId}: HTTP ${res.status}`);
  const xml = await res.text();
  if (!/<code>200<\/code>/.test(xml)) throw new Error(`BOE ${blockId}: ${xml.slice(0, 200)}`);
  return xml;
}

function readCorpus(): CorpusRecord[] {
  return existsSync(CORPUS) ? (JSON.parse(readFileSync(CORPUS, "utf8")) as CorpusRecord[]) : [];
}

async function updateSnapshots(): Promise<void> {
  const blocks = [...new Set([...DEFAULT_BLOCKS, ...readCorpus().map((r) => r.boeBlockId)])];
  mkdirSync(SNAPSHOTS, { recursive: true });
  for (const blockId of blocks) {
    const xml = await fetchBlock(blockId);
    writeFileSync(resolve(SNAPSHOTS, `${blockId}.xml`), xml);
    process.stdout.write(`${blockId}: version ${lastVersion(xml).date}\n`);
  }
}

async function printBlock(blockId: string): Promise<void> {
  const { date, body } = lastVersion(await fetchBlock(blockId));
  process.stdout.write(`${blockId} (${date})\n${plainText(body).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n")}\n`);
}

async function check(): Promise<number> {
  const corpus = readCorpus();
  const cache = new Map<string, { date: string; text: string }>();
  const problems: string[] = [];
  for (const record of corpus) {
    if (!cache.has(record.boeBlockId)) {
      const { date, body } = lastVersion(await fetchBlock(record.boeBlockId));
      cache.set(record.boeBlockId, { date, text: norm(plainText(body)) });
    }
    const block = cache.get(record.boeBlockId)!;
    if (!block.text.includes(norm(record.excerptEs))) problems.push(`${record.id}: excerpt no longer in ${record.boeBlockId}`);
    if (block.date !== record.versionDate) {
      problems.push(`${record.id}: ${record.boeBlockId} is now version ${block.date}, corpus says ${record.versionDate}`);
    }
  }
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  if (problems.length > 0) return 1;
  process.stdout.write(`${corpus.length} rules match the BOE\n`);
  return 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--update-snapshot")) {
    await updateSnapshots();
  } else if (args.includes("--print")) {
    await printBlock(args[args.indexOf("--print") + 1] ?? "");
  } else {
    process.exitCode = await check();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
