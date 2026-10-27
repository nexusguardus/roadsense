/**
 * RoadSense from the command line: analyses one photo of a junction and prints
 * what the learner must do, how sure RoadSense is, the evidence and the law.
 *
 *   npx tsx scripts/roadsense/analyze.ts <image> [--locale en] [--replay] [--json]
 *
 * A live run needs MODEL_API_KEY (in the environment or .env.local) and uses
 * Standard mode at low reasoning effort, as learners' uploads do. --replay answers
 * from the recorded evaluation instead, with no key and no cost; it knows only the
 * curated scene images in public/roadsense/scenes, analysed in English.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { corpusFrom } from "../../lib/roadsense/corpus";
import { sniffImageType, stripImageMetadata, toDataUrl } from "../../lib/roadsense/image";
import { createMetaClient, type MetaClient } from "../../lib/roadsense/meta-client";
import { analyzeScene } from "../../lib/roadsense/pipeline";
import { createReplayClient } from "../../lib/roadsense/replay";
import type { AnalysisResult, RoadsenseLocale } from "../../lib/roadsense/types";
import { readModelKey } from "./env";

const LOCALES: readonly RoadsenseLocale[] = ["es", "en", "fr", "ar"];
const LIVE_BUDGET_MS = 60_000;
const REPLAY_BUDGET_MS = 300_000;
const RECORDINGS = resolve("data/roadsense/recordings");

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Every recorded call of the evaluation, in one map: their keys are hashes of the calls. */
function recordedClient(): MetaClient {
  const calls: Record<string, unknown> = {};
  for (const file of readdirSync(RECORDINGS).filter((name) => name.endsWith(".json"))) {
    Object.assign(calls, (JSON.parse(readFileSync(resolve(RECORDINGS, file), "utf8")) as { calls: Record<string, unknown> }).calls);
  }
  return createReplayClient(calls);
}

function describe(result: AnalysisResult): string[] {
  const lines = [`Certainty: ${result.certainty}`];
  const { engine, model } = result;
  if (result.certainty === "outside_scope") lines.push(`Out of scope: ${result.facts.outOfScopeReason ?? "other"}`);
  if (engine.status === "insufficient") lines.push(`Missing: ${engine.missing.join(", ") || "the rules cited don't settle this case"}`);
  if (engine.obligation || model) lines.push(`Answer: rule engine ${engine.obligation ?? "none"}; Muse Spark ${model?.obligation ?? "none"}`);
  if (model) {
    lines.push(`Why: ${model.rationale}`, `Tempting wrong answer: ${model.temptingWrongAnswer} (${model.whyWrong})`);
  }
  for (const check of result.evidence) {
    lines.push(`Evidence: ${check.factId} ${check.concept}: ${check.confirmed ? "confirmed" : "not confirmed"} by SAM 3.1 (overlap ${check.overlap.toFixed(2)})`);
  }
  const cited = new Set([...engine.ruleIds, ...(model?.ruleIds ?? [])]);
  for (const rule of result.rules.filter((r) => cited.has(r.id))) lines.push(`Rule: ${rule.id}, ${rule.article} (${rule.boeUrl})`);
  lines.push(`Models: ${result.modelIds.join(", ")}; ${(result.latencyMs / 1000).toFixed(1)} s; $${result.costUsd.toFixed(4)}`);
  return lines;
}

async function main(): Promise<void> {
  const imageFile = process.argv[2];
  if (!imageFile || imageFile.startsWith("--")) throw new Error("usage: analyze.ts <image> [--locale en] [--replay] [--json]");
  const locale = (flag("--locale") ?? "en") as RoadsenseLocale;
  if (!LOCALES.includes(locale)) throw new Error("--locale must be es, en, fr or ar");
  const replay = process.argv.includes("--replay");

  const bytes = new Uint8Array(readFileSync(resolve(imageFile)));
  const type = sniffImageType(bytes);
  if (type === null) throw new Error("the image must be a JPEG, PNG or WebP file");
  // A replay must send the exact bytes the evaluation sent; a live run strips the metadata first, as the app does.
  const imageDataUrl = toDataUrl(replay ? bytes : stripImageMetadata(bytes, type), type);
  const client = replay
    ? recordedClient()
    : createMetaClient({ apiKey: process.env.MODEL_API_KEY || readModelKey(), reasoningEffort: "low", timeoutMs: LIVE_BUDGET_MS });
  const corpus = corpusFrom(JSON.parse(readFileSync(resolve("data/roadsense/corpus.json"), "utf8")));

  let result: AnalysisResult;
  try {
    result = await analyzeScene({ client, corpus, evidenceMode: "sam", budgetMs: replay ? REPLAY_BUDGET_MS : LIVE_BUDGET_MS }, { imageDataUrl, locale });
  } catch (err) {
    if (replay && err instanceof Error && err.message.startsWith("no recording")) {
      throw new Error("--replay knows only the curated scene images in public/roadsense/scenes, analysed in English (--locale en)");
    }
    throw err;
  }
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`RoadSense: ${basename(imageFile)} (${locale}${replay ? ", replay" : ""})`);
  for (const line of describe(result)) console.log(line);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
