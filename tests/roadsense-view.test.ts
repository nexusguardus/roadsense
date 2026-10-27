// The /roadsense page's pure helpers: where evidence boxes go, why an answer is
// "not sure", which rules a result shows, what-if chip labels, NDJSON stream
// lines and the size a learner's photo is scaled to before it is sent.
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

const view = await import("../components/roadsense/view.ts");
const {
  boxStyle,
  evidenceOverlays,
  notSureReasons,
  rulesToShow,
  showsAmberException,
  disagreement,
  whatIfLabelKey,
  fitWithin,
  splitLines,
  parseStreamLine,
  fillTemplate,
} = await import("../components/roadsense/view.ts");

const BOX = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });
const rule = (id: string) => ({
  id,
  law: "RGC",
  boeBlockId: "a56",
  article: "Art. 56",
  title: id,
  excerptEs: "texto",
  boeUrl: "https://www.boe.es/buscar/act.php?id=BOE-A-2003-23514#a56",
  versionDate: "2026-10-01",
  sha256: "0",
  explanation: { es: "e", en: "e", fr: "e", ar: "e" },
});
const FACTS = {
  inScope: true,
  outOfScopeReason: null,
  junction: "crossroads",
  egoRoadPaved: true,
  crossRoadPaved: true,
  signs: [{ id: "s1", kind: "stop", appliesTo: "ego", box: BOX(600, 200, 700, 400), confidence: 0.9 }],
  lights: [],
  markings: [],
  roadUsers: [{ id: "u1", kind: "car", position: "from_right", emergencyLightsOn: false, box: BOX(700, 500, 900, 700), confidence: 0.4 }],
  unknowns: [],
};
const DECISION = {
  obligation: "stop_and_yield",
  priorityTo: [],
  rationale: "r",
  temptingWrongAnswer: "t",
  whyWrong: "w",
  ruleIds: ["rgc-56-5"],
};
function result(partial: Record<string, unknown> = {}) {
  return {
    certainty: "checked",
    facts: FACTS,
    evidence: [
      { factId: "s1", concept: "traffic sign", confirmed: true, factBox: BOX(600, 200, 700, 400), matchedBox: BOX(610, 210, 690, 390), overlap: 0.9 },
    ],
    engine: { status: "decided", obligation: "stop_and_yield", ruleIds: ["rgc-56-5"], criticalFactIds: ["s1"], missing: [] },
    model: DECISION,
    rules: [rule("rgc-56-5"), rule("rgc-57-1"), rule("anexo-i-light-amber")],
    costUsd: 0,
    latencyMs: 0,
    modelIds: [],
    ...partial,
  };
}

test("boxes on the 0-1000 grid become percentages of the photo", () => {
  assert.deepEqual(boxStyle(BOX(100, 250, 400, 1000)), { left: "10%", top: "25%", width: "30%", height: "75%" });
});

test("boxes outside the grid are clamped to the photo", () => {
  assert.deepEqual(boxStyle(BOX(-50, 900, 1200, 1100)), { left: "0%", top: "90%", width: "100%", height: "10%" });
});

test("confirmed facts are drawn at SAM's box, unconfirmed ones at Muse Spark's", () => {
  const overlays = evidenceOverlays(
    result({
      evidence: [
        { factId: "s1", concept: "traffic sign", confirmed: true, factBox: BOX(1, 1, 2, 2), matchedBox: BOX(3, 3, 4, 4), overlap: 0.8 },
        { factId: "u1", concept: "car", confirmed: false, factBox: BOX(5, 5, 6, 6), matchedBox: null, overlap: 0.1 },
      ],
    }),
  );
  assert.deepEqual(overlays, [
    { factId: "s1", box: BOX(3, 3, 4, 4), confirmed: true },
    { factId: "u1", box: BOX(5, 5, 6, 6), confirmed: false },
  ]);
});

test("a checked answer has no not-sure reasons", () => {
  assert.deepEqual(notSureReasons(result()), []);
});

test("an insufficient verdict names what is missing", () => {
  const verdict = { status: "insufficient", obligation: null, ruleIds: [], criticalFactIds: [], missing: ["ego_signage_hidden", "right_approach_hidden"] };
  assert.deepEqual(notSureReasons(result({ certainty: "not_sure", engine: verdict, model: null, evidence: [] })), [
    { kind: "unknown", code: "ego_signage_hidden" },
    { kind: "unknown", code: "right_approach_hidden" },
  ]);
});

test("an insufficient verdict with nothing missing is unsettled", () => {
  const verdict = { status: "insufficient", obligation: null, ruleIds: [], criticalFactIds: [], missing: [] };
  assert.deepEqual(notSureReasons(result({ certainty: "not_sure", engine: verdict, model: null, evidence: [] })), [{ kind: "unsettled" }]);
});

test("unconfirmed evidence, a doubtful fact and a missing explanation are each a reason", () => {
  const engine = { status: "decided", obligation: "yield", ruleIds: ["rgc-57-1"], criticalFactIds: ["s1", "u1"], missing: [] };
  const evidence = [
    { factId: "s1", concept: "traffic sign", confirmed: true, factBox: BOX(1, 1, 2, 2), matchedBox: BOX(1, 1, 2, 2), overlap: 1 },
    { factId: "u1", concept: "car", confirmed: false, factBox: BOX(5, 5, 6, 6), matchedBox: null, overlap: 0 },
  ];
  assert.deepEqual(notSureReasons(result({ certainty: "not_sure", engine, evidence, model: null })), [
    { kind: "unconfirmed" },
    { kind: "low_confidence" },
    { kind: "no_explanation" },
  ]);
});

test("a critical fact SAM never looked at counts as unconfirmed", () => {
  const engine = { status: "decided", obligation: "stop_and_yield", ruleIds: ["rgc-56-5"], criticalFactIds: ["s1"], missing: [] };
  assert.deepEqual(notSureReasons(result({ certainty: "not_sure", engine, evidence: [] })), [{ kind: "unconfirmed" }]);
});

test("checked and disagree results show the engine's rules, then the ones the model cited", () => {
  const model = { ...DECISION, ruleIds: ["rgc-57-1", "rgc-56-5"] };
  assert.deepEqual(rulesToShow(result({ model })).map((r) => r.id), ["rgc-56-5", "rgc-57-1"]);
  assert.deepEqual(rulesToShow(result({ certainty: "disagree", model })).map((r) => r.id), ["rgc-56-5", "rgc-57-1"]);
});

test("a not-sure result shows no rules, so no answer is implied", () => {
  assert.deepEqual(rulesToShow(result({ certainty: "not_sure" })), []);
});

test("an out-of-scope result shows only the engine's own rules", () => {
  const engine = { status: "out_of_scope", obligation: null, ruleIds: ["rgc-57-1"], criticalFactIds: [], missing: [] };
  assert.deepEqual(rulesToShow(result({ certainty: "outside_scope", engine, model: null })).map((r) => r.id), ["rgc-57-1"]);
  const none = { ...engine, ruleIds: [] };
  assert.deepEqual(rulesToShow(result({ certainty: "outside_scope", engine: none, model: null })), []);
});

test("the steady-amber exception shows only when the amber rule decided the answer", () => {
  const amber = { status: "decided", obligation: "stop_at_light", ruleIds: ["anexo-i-light-amber"], criticalFactIds: ["s1"], missing: [] };
  assert.equal(showsAmberException(result({ engine: amber })), true);
  assert.equal(showsAmberException(result({ engine: amber, certainty: "not_sure" })), false);
  assert.equal(showsAmberException(result()), false);
});

test("a disagreement is about the answer or only about the citation", () => {
  assert.equal(disagreement(result()), null);
  assert.equal(disagreement(result({ certainty: "disagree", model: { ...DECISION, obligation: "proceed" } })), "answers");
  assert.equal(disagreement(result({ certainty: "disagree", model: { ...DECISION, ruleIds: ["rgc-57-1"] } })), "citation");
});

test("what-if chips are labelled by the change they make", () => {
  assert.equal(whatIfLabelKey({ kind: "swap_sign", factId: "s1", to: "stop" }), "swap_to_stop");
  assert.equal(whatIfLabelKey({ kind: "swap_sign", factId: "s1", to: "yield" }), "swap_to_yield");
  assert.equal(whatIfLabelKey({ kind: "remove_sign", factId: "s1" }), "remove_sign");
  assert.equal(whatIfLabelKey({ kind: "set_light", factId: "l1", to: "red" }), "light_red");
  assert.equal(whatIfLabelKey({ kind: "set_light", factId: "l1", to: "green" }), "light_green");
  assert.equal(whatIfLabelKey({ kind: "add_emergency_vehicle" }), "add_emergency_vehicle");
  assert.equal(whatIfLabelKey({ kind: "add_pedestrian_on_crossing" }), "add_pedestrian_on_crossing");
});

test("photos are scaled so their longer side is at most 1920 px", () => {
  assert.deepEqual(fitWithin(4032, 3024, 1920), { width: 1920, height: 1440 });
  assert.deepEqual(fitWithin(3024, 4032, 1920), { width: 1440, height: 1920 });
  assert.deepEqual(fitWithin(800, 600, 1920), { width: 800, height: 600 });
});

test("NDJSON chunks split into whole lines and a remainder", () => {
  assert.deepEqual(splitLines('{"a":1}\n{"b"'), { lines: ['{"a":1}'], rest: '{"b"' });
  assert.deepEqual(splitLines('2}\n\n{"c":3}\n'), { lines: ['2}', '{"c":3}'], rest: "" });
});

test("stream lines are parsed only when they are a known type", () => {
  assert.deepEqual(parseStreamLine('{"type":"stage","stage":"perceive"}'), { type: "stage", stage: "perceive" });
  assert.deepEqual(parseStreamLine('{"type":"error","code":"timeout"}'), { type: "error", code: "timeout" });
  assert.equal(parseStreamLine('{"type":"stage","stage":"launch"}'), null);
  assert.equal(parseStreamLine('{"type":"surprise"}'), null);
  assert.equal(parseStreamLine("not json"), null);
  const line = parseStreamLine('{"type":"result","applied":false,"imageDataUrl":null,"result":null}');
  assert.deepEqual(line, { type: "result", applied: false, imageDataUrl: null, result: null });
});

const { readAnalysisStream } = await import("../components/roadsense/useAnalysisStream.ts");

/** A streamed NDJSON response cut into the given chunks. */
function ndjson(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
}

test("a live stream reports each stage, then its result", async () => {
  const stages: string[] = [];
  const done = await readAnalysisStream(
    ndjson(['{"type":"stage","stage":"perceive"}\n{"type":"st', 'age","stage":"decide"}\n', `{"type":"result","result":${JSON.stringify(result())}}\n`]),
    (stage) => stages.push(stage),
  );
  assert.deepEqual(stages, ["perceive", "decide"]);
  assert.equal(done.status, "done");
  assert.equal(done.status === "done" && done.outcome.result?.certainty, "checked");
});

test("a live what-if that didn't come out right is a result, not an error", async () => {
  const done = await readAnalysisStream(ndjson(['{"type":"result","applied":false,"imageDataUrl":null,"result":null}']), () => {});
  assert.deepEqual(done, { status: "done", outcome: { result: null, applied: false, imageDataUrl: null } });
});

test("an error line ends the stream with its code", async () => {
  const done = await readAnalysisStream(ndjson(['{"type":"stage","stage":"perceive"}\n{"type":"error","code":"timeout"}\n']), () => {});
  assert.deepEqual(done, { status: "error", error: { code: "timeout" } });
});

test("a stream that stops without a result is an internal error", async () => {
  const done = await readAnalysisStream(ndjson(['{"type":"stage","stage":"perceive"}\n']), () => {});
  assert.deepEqual(done, { status: "error", error: { code: "internal" } });
});

test("Spanish terms in brackets are split out so Arabic text can isolate them", () => {
  const { splitSpanishTerms } = view;
  assert.deepEqual(splitSpanishTerms("ضوء أخضر (luz verde) ثابت"), [
    { text: "ضوء أخضر ", spanish: false },
    { text: "(luz verde)", spanish: true },
    { text: " ثابت", spanish: false },
  ]);
  assert.deepEqual(splitSpanishTerms("بدون مصطلحات (مثال)"), [{ text: "بدون مصطلحات (مثال)", spanish: false }]);
});

test("templates fill their numbered gaps", () => {
  assert.equal(fillTemplate("{right} of {total}, {right}", { right: 22, total: 24 }), "22 of 24, 22");
});
