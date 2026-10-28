// The evaluation scores a run of the pipeline over the curated scenes against
// their ground truth, and replays recorded model calls so the numbers can be
// reproduced at no cost.
import { test } from "node:test";
import assert from "node:assert/strict";
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

const { scoreRun, renderEvalMarkdown, nearestRank } = await import("../lib/roadsense/eval.ts");
const { recordingKey, createRecordingClient, createReplayClient } = await import("../lib/roadsense/replay.ts");

const CORPUS_IDS = ["rgc-56-1", "rgc-56-5", "rgc-57-1", "rgc-58-1", "rgc-133-1"];

/** A result with the given certainty and model obligation. */
function result(certainty: string, obligation: string | null, extra: Record<string, unknown> = {}) {
  return {
    certainty,
    facts: {},
    evidence: [],
    engine: { status: "decided", obligation: "yield", ruleIds: ["rgc-56-1", "rgc-56-5", "rgc-133-1"], criticalFactIds: [], missing: [] },
    model: obligation === null ? null : { obligation, priorityTo: [], rationale: "r", temptingWrongAnswer: "t", whyWrong: "w", ruleIds: ["rgc-56-5"] },
    rules: ["rgc-56-1", "rgc-56-5", "rgc-133-1", "rgc-58-1"].map((id) => ({ id })),
    costUsd: 0.01,
    latencyMs: 9000,
    modelIds: ["muse-spark-1.3", "sam-3.1"],
    ...extra,
  };
}
const YIELD = { kind: "answerable", obligation: "yield", ruleIds: ["rgc-56-1", "rgc-56-5", "rgc-133-1"] };
const ABSTAIN = { kind: "abstain", obligation: null, ruleIds: [] };
const OUT = { kind: "out_of_scope", obligation: null, ruleIds: [] };
const row = (sceneId: string, expected: unknown, res: unknown, error: string | null = null) => ({ sceneId, expected, result: res, error });

test("counts a checked right answer as correct", () => {
  const report = scoreRun([row("s1", YIELD, result("checked", "yield"))], CORPUS_IDS);
  assert.deepEqual(report.answerable, { total: 1, correct: 1, notSure: 0, checkedWrong: 0 });
  assert.deepEqual(report.byRule["rgc-56-5"], { total: 1, correct: 1 });
  assert.deepEqual(report.failures, []);
});

test("counts a checked wrong answer as checkedWrong", () => {
  const report = scoreRun([row("s1", YIELD, result("checked", "proceed"))], CORPUS_IDS);
  assert.deepEqual(report.answerable, { total: 1, correct: 0, notSure: 0, checkedWrong: 1 });
  assert.equal(report.failures.length, 1);
  assert.match(report.failures[0], /s1/);
});

test("not sure on an answerable scene is neither correct nor wrong", () => {
  const report = scoreRun([row("s1", YIELD, result("not_sure", null))], CORPUS_IDS);
  assert.deepEqual(report.answerable, { total: 1, correct: 0, notSure: 1, checkedWrong: 0 });
});

test("abstain and out-of-scope scenes are correct only with their own certainty", () => {
  const report = scoreRun(
    [
      row("a1", ABSTAIN, result("not_sure", null)),
      row("a2", ABSTAIN, result("checked", "proceed")),
      row("o1", OUT, result("outside_scope", null)),
    ],
    CORPUS_IDS,
  );
  assert.deepEqual(report.abstain, { total: 2, correct: 1 });
  assert.deepEqual(report.outOfScope, { total: 1, correct: 1 });
});

test("a citation is valid when the corpus has it and the scene's rules include it", () => {
  const strayInCorpus = result("checked", "yield", {
    model: { obligation: "yield", priorityTo: [], rationale: "r", temptingWrongAnswer: "t", whyWrong: "w", ruleIds: ["rgc-56-5", "rgc-58-1", "rgc-57-1"] },
  });
  const report = scoreRun([row("s1", YIELD, strayInCorpus)], CORPUS_IDS);
  // rgc-56-5 is the engine's, rgc-58-1 was retrieved for the model, rgc-57-1 was neither.
  assert.deepEqual(report.citations, { total: 3, valid: 2 });
});

test("an analysis that failed counts against the schema rate", () => {
  const report = scoreRun([row("s1", YIELD, result("checked", "yield")), row("s2", YIELD, null, "MetaTimeoutError")], CORPUS_IDS);
  assert.deepEqual(report.schema, { total: 2, valid: 1 });
  assert.ok(report.failures.some((f) => f.includes("s2") && f.includes("MetaTimeoutError")));
});

test("p95 uses nearest rank", () => {
  const latencies = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.equal(nearestRank(latencies, 50), 10);
  assert.equal(nearestRank(latencies, 95), 19);
  const report = scoreRun(
    latencies.map((ms, i) => row(`s${i}`, YIELD, result("checked", "yield", { latencyMs: ms }))),
    CORPUS_IDS,
  );
  assert.deepEqual(report.latencyMs, { p50: 10, p95: 19 });
});

test("adds up cost", () => {
  const report = scoreRun([row("s1", YIELD, result("checked", "yield")), row("s2", ABSTAIN, result("not_sure", null))], CORPUS_IDS);
  assert.ok(Math.abs(report.costUsd.total - 0.02) < 1e-9);
  assert.ok(Math.abs(report.costUsd.perScene - 0.01) < 1e-9);
});

test("report marks met and missed targets", () => {
  const meta = { mode: "replay" as const, date: "2026-10-27", modelIds: ["muse-spark-1.3-contributor", "sam-3.1"] };
  const clean = renderEvalMarkdown(scoreRun([row("s1", YIELD, result("checked", "yield"))], CORPUS_IDS), meta);
  assert.doesNotMatch(clean, /MISSED/);
  assert.match(clean, /muse-spark-1\.3-contributor/);
  const wrong = renderEvalMarkdown(scoreRun([row("s1", YIELD, result("checked", "proceed"))], CORPUS_IDS), meta);
  assert.match(wrong, /MISSED/);
});

/** A MetaClient stand-in that answers every call once and counts them. */
function fakeInner() {
  const calls = { count: 0 };
  const client = {
    sparkModel: "muse-spark-1.3-contributor",
    async chatJson() {
      calls.count++;
      return { json: { answer: calls.count }, costUsd: 0.01 };
    },
    async segment() {
      calls.count++;
      return { text: "<0f>", costUsd: 0.0025 };
    },
    async editImage() {
      calls.count++;
      return { imageDataUrl: "data:image/webp;base64,EDIT", costUsd: 0.01 };
    },
    async generateImage() {
      calls.count++;
      return { imageDataUrl: "data:image/webp;base64,GEN", costUsd: 0.01 };
    },
  };
  return { client, calls };
}
const CHAT = { system: "s", user: "u", imageDataUrl: "data:image/webp;base64,AAAA", schemaName: "scene_facts", schema: { type: "object" } };

test("recording key is the same for the same call and ignores the image's size", () => {
  assert.equal(recordingKey("chatJson", CHAT), recordingKey("chatJson", { ...CHAT }));
  assert.notEqual(recordingKey("chatJson", CHAT), recordingKey("chatJson", { ...CHAT, user: "other" }));
  assert.notEqual(recordingKey("chatJson", CHAT), recordingKey("segment", CHAT));
  assert.ok(recordingKey("chatJson", { ...CHAT, imageDataUrl: `data:image/webp;base64,${"A".repeat(100_000)}` }).length <= 64);
});

test("replay client returns the recorded response for the same call", async () => {
  const sink: Record<string, unknown> = {};
  const { client, calls } = fakeInner();
  const recording = createRecordingClient(client, sink);
  const live = await recording.chatJson(CHAT);
  const sam = await recording.segment({ imageDataUrl: CHAT.imageDataUrl, concept: "traffic sign" });
  const replay = createReplayClient(JSON.parse(JSON.stringify(sink)));
  assert.deepEqual(await replay.chatJson(CHAT), live);
  assert.deepEqual(await replay.segment({ imageDataUrl: CHAT.imageDataUrl, concept: "traffic sign" }), sam);
  assert.equal(replay.sparkModel, "muse-spark-1.3-contributor");
  assert.equal(calls.count, 2);
});

test("replay client throws for an unrecorded call", async () => {
  const replay = createReplayClient({});
  await assert.rejects(replay.chatJson(CHAT), /no recording/);
});

test("a checked answer on an abstain or out-of-scope scene counts as checked wrong", () => {
  const report = scoreRun([row("a1", ABSTAIN, result("checked", "yield")), row("o1", OUT, result("checked", "yield")), row("s1", YIELD, result("checked", "yield"))], CORPUS_IDS);
  assert.equal(report.checkedWrong, 2);
  // The answerable count keeps its own figure.
  assert.equal(report.answerable.checkedWrong, 0);
});

test("a decision rejected for its shape counts as invalid structured output", () => {
  const report = scoreRun([row("s1", YIELD, result("not_sure", null)), row("s2", YIELD, result("checked", "yield"))], CORPUS_IDS);
  assert.deepEqual(report.schema, { total: 2, valid: 1 });
});

test("the report's wrong-checked row counts every kind of scene", () => {
  const report = scoreRun([row("a1", ABSTAIN, result("checked", "yield"))], CORPUS_IDS);
  const markdown = renderEvalMarkdown(report, { mode: "replay", date: "2026-10-27", modelIds: ["muse-spark-1.3"] });
  assert.match(markdown, /Wrong answers marked checked \| 1 \|/);
});

// Typed what-ifs (2026-10-27 redesign): how well learners' words are understood. A wrong
// reading could run the wrong edit, so it counts apart from a miss, which only says "none".
const { scoreUnderstanding } = await import("../lib/roadsense/eval.ts");

test("scoreUnderstanding counts matched, wrong and missed", () => {
  assert.deepEqual(
    scoreUnderstanding([
      { expected: { kind: "set_light", to: "red" }, got: { kind: "set_light", to: "red" } },
      { expected: { kind: "set_light", to: "red" }, got: { kind: "set_light" } },
      { expected: { kind: "none" }, got: { kind: "add_emergency_vehicle" } },
      { expected: { kind: "remove_sign" }, got: { kind: "none" } },
      { expected: { kind: "none" }, got: { kind: "none" } },
    ]),
    { total: 5, matched: 2, wrong: 2, missed: 1 },
  );
});

test("a direction the phrase doesn't name may be given or left out", () => {
  assert.deepEqual(
    scoreUnderstanding([
      { expected: { kind: "swap_sign" }, got: { kind: "swap_sign", to: "yield" } },
      { expected: { kind: "swap_sign" }, got: { kind: "swap_sign" } },
      { expected: { kind: "swap_sign", to: "stop" }, got: { kind: "swap_sign", to: "yield" } },
    ]),
    { total: 3, matched: 2, wrong: 1, missed: 0 },
  );
});
