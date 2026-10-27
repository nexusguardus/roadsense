// Task 14: runs the analysis pipeline over every curated scene and scores it against the
// ground truth (lib/roadsense/eval.ts). Run from the repo root:
//
//   npx tsx scripts/roadsense/eval.ts --mode live --record   calls Meta and saves the recordings
//   npx tsx scripts/roadsense/eval.ts --mode replay          replays them: the same numbers, at $0
//
// Options: --only id,id   --spark standard|contributor (live, default contributor)
//          --effort low|medium|high (Muse Spark reasoning effort; default: the model's)
//          --out <file.md> (default docs/roadsense/EVAL.md; results go next to it as .json)
//
// Live runs use contributor mode unless told otherwise (DriveIQ's own images, owner
// 2026-10-26). Each scene is analysed once, in English, from its published 1280 px image,
// the size learners' uploads are resized to. tsx loads this file as CommonJS: all in main().
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { corpusFrom } from "../../lib/roadsense/corpus";
import { renderEvalMarkdown, scoreRun, type EvalRow } from "../../lib/roadsense/eval";
import { createMetaClient, type MetaClient, type ReasoningEffort, type SparkMode } from "../../lib/roadsense/meta-client";
import { analyzeScene } from "../../lib/roadsense/pipeline";
import { createRecordingClient, createReplayClient } from "../../lib/roadsense/replay";
import { scenesFrom } from "../../lib/roadsense/scenes";
import type { CuratedScene } from "../../lib/roadsense/types";
import { inPool, readModelKey } from "./env";

const LOCALE = "en";
const RECORDINGS = resolve("data/roadsense/recordings");
const CONCURRENCY = 2;
/** Contributor mode answers more slowly than Standard; the latency it records is reported as measured. */
const BUDGET_MS = 300_000;

interface Recording {
  latencyMs: number;
  calls: Record<string, unknown>;
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

const imageOf = (scene: CuratedScene): string =>
  `data:image/webp;base64,${readFileSync(resolve(`public${scene.imagePath}`)).toString("base64")}`;

async function evaluate(scene: CuratedScene, mode: "live" | "replay", client: () => MetaClient, recording: Recording | null) {
  const corpus = corpusFrom(JSON.parse(readFileSync(resolve("data/roadsense/corpus.json"), "utf8")));
  const result = await analyzeScene({ client: client(), corpus, evidenceMode: "sam", budgetMs: BUDGET_MS }, { imageDataUrl: imageOf(scene), locale: LOCALE });
  // A replay takes no time at all, so it reports the latency the live run recorded.
  return mode === "replay" && recording ? { ...result, latencyMs: recording.latencyMs } : result;
}

async function main(): Promise<void> {
  const mode = flag("--mode") ?? "replay";
  if (mode !== "live" && mode !== "replay") throw new Error("--mode must be live or replay");
  const record = mode === "live" && process.argv.includes("--record");
  const spark = (flag("--spark") ?? "contributor") as SparkMode;
  if (spark !== "standard" && spark !== "contributor") throw new Error("--spark must be standard or contributor");
  const effort = flag("--effort") as ReasoningEffort | undefined;
  if (effort !== undefined && !["low", "medium", "high"].includes(effort)) throw new Error("--effort must be low, medium or high");
  const only = flag("--only")?.split(",");
  const out = resolve(flag("--out") ?? (only ? "scratch/roadsense/eval-partial.md" : "docs/roadsense/EVAL.md"));
  const allScenes = scenesFrom(JSON.parse(readFileSync(resolve("data/roadsense/scenes/index.json"), "utf8")));
  const scenes = allScenes.filter((scene) => !only || only.includes(scene.id));
  const corpusIds = corpusFrom(JSON.parse(readFileSync(resolve("data/roadsense/corpus.json"), "utf8"))).map((rule) => rule.id);
  const apiKey = mode === "live" ? readModelKey() : "";
  mkdirSync(RECORDINGS, { recursive: true });

  const rows = new Map<string, EvalRow>();
  await inPool(scenes, CONCURRENCY, async (scene) => {
    const file = resolve(RECORDINGS, `${scene.id}.json`);
    const sink: Record<string, unknown> = {};
    try {
      let recording: Recording | null = null;
      let client: () => MetaClient;
      if (mode === "live") {
        const live = createMetaClient({ apiKey, sparkMode: spark, reasoningEffort: effort, timeoutMs: 120_000 });
        client = () => (record ? createRecordingClient(live, sink) : live);
      } else {
        if (!existsSync(file)) throw new Error("no recording for this scene");
        const saved = JSON.parse(readFileSync(file, "utf8")) as Recording;
        recording = saved;
        client = () => createReplayClient(saved.calls);
      }
      const result = await evaluate(scene, mode, client, recording);
      if (record) writeFileSync(file, `${JSON.stringify({ latencyMs: result.latencyMs, calls: sink }, null, 2)}\n`);
      rows.set(scene.id, { sceneId: scene.id, expected: scene.expected, result, error: null });
      process.stdout.write(`${scene.id}: ${result.certainty}${result.model ? ` (${result.model.obligation})` : ""}, ${Math.round(result.latencyMs / 1000)} s\n`);
    } catch (err) {
      const error = err instanceof Error ? `${err.name}: ${err.message.slice(0, 160)}` : String(err);
      rows.set(scene.id, { sceneId: scene.id, expected: scene.expected, result: null, error });
      process.stdout.write(`FAIL ${scene.id}: ${error}\n`);
    }
  });

  const ordered = scenes.map((scene) => rows.get(scene.id)).filter((row): row is EvalRow => row !== undefined);
  const report = scoreRun(ordered, corpusIds);
  const modelIds = [...new Set(ordered.flatMap((row) => row.result?.modelIds ?? []))].map((id) =>
    effort && id.startsWith("muse-spark") ? `${id} (reasoning effort ${effort})` : id,
  );
  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(dirname(out), { recursive: true });
  // The full report ends with the hand-written method and latency notes, so a replay rebuilds all of it.
  const notesFile = resolve("docs/roadsense/eval-notes.md");
  const notes = out.endsWith("EVAL.md") && existsSync(notesFile) ? `\n${readFileSync(notesFile, "utf8")}` : "";
  writeFileSync(out, `${renderEvalMarkdown(report, { mode, date, modelIds })}${notes}`);
  const results = ordered.map(({ sceneId, expected, result, error }) => ({
    sceneId,
    expected,
    certainty: result?.certainty ?? null,
    obligation: result?.model?.obligation ?? null,
    engineObligation: result?.engine.obligation ?? null,
    ruleIds: result?.model?.ruleIds ?? [],
    latencyMs: result?.latencyMs ?? null,
    costUsd: result?.costUsd ?? null,
    error,
  }));
  writeFileSync(out.replace(/EVAL\.md$/, "eval-results.json").replace(/\.md$/, ".json"), `${JSON.stringify({ mode, spark, effort: effort ?? "default", date, locale: LOCALE, report, results }, null, 2)}\n`);
  const a = report.answerable;
  process.stdout.write(
    `answerable ${a.correct}/${a.total} right and checked, ${a.checkedWrong} checked wrong, ${a.notSure} not sure; abstain ${report.abstain.correct}/${report.abstain.total}; out of scope ${report.outOfScope.correct}/${report.outOfScope.total}; p95 ${report.latencyMs.p95} ms; $${report.costUsd.total.toFixed(3)}\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}\n`);
  process.exitCode = 1;
});
