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

test("an answer with nothing in the photo to confirm says so", () => {
  const engine = { status: "decided", obligation: "proceed", ruleIds: ["rgc-57-1"], criticalFactIds: [], missing: [] };
  assert.deepEqual(notSureReasons(result({ certainty: "not_sure", engine, evidence: [] })), [{ kind: "nothing_to_confirm" }]);
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
  assert.deepEqual(parseStreamLine('{"type":"error","code":"model","refunded":false}'), { type: "error", code: "model", refunded: false });
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
  const done = await readAnalysisStream(ndjson(['{"type":"stage","stage":"perceive"}\n{"type":"error","code":"timeout","refunded":true}\n']), () => {});
  // The server says whether the failed analysis was refunded, so the page can say whether it counted.
  assert.deepEqual(done, { status: "error", error: { code: "timeout", refunded: true } });
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

test("learner photos are kept out of session recordings", () => {
  // PostHog replays record image sources unless the element carries ph-no-capture; uploads and live edits are data URLs.
  const { readFileSync } = process.getBuiltinModule("node:fs") as typeof import("node:fs");
  // Elements, not the word in comments: a JSX <img> always has attributes.
  const imagesIn = (file: string) =>
    readFileSync(new URL(`../components/roadsense/${file}`, import.meta.url), "utf8").match(/<img\s[^>]*>/gs) ?? [];
  // Every learner photo, picked, analysed or edited, is shown by EvidenceImage.
  const images = imagesIn("EvidenceImage.tsx");
  assert.ok(images.length > 0);
  for (const image of images) assert.match(image, /ph-no-capture/, image.slice(0, 60));
  // The upload panel sits beside the picked photo and shows no image of its own.
  assert.deepEqual(imagesIn("UploadPanel.tsx"), []);
});

// Final review (2026-10-27): focus, Arabic isolation and analytics in the what-if box and thread.
const roadsenseSource = (file: string): string => {
  const { readFileSync } = process.getBuiltinModule("node:fs") as typeof import("node:fs");
  return readFileSync(new URL(`../components/roadsense/${file}`, import.meta.url), "utf8");
};

test("the What-if box keeps keyboard focus while a question runs", () => {
  const source = roadsenseSource("WhatIfBox.tsx");
  const start = source.indexOf("<input");
  const input = source.slice(start, source.indexOf("/>", start));
  assert.match(input, /type="text"/, "the box is a real text input");
  // A focused control that becomes disabled loses focus; only the Ask button and the chips wait.
  assert.doesNotMatch(input, /\sdisabled=/);
});

test("Run it pressed from the keyboard hands focus back to the What-if box", () => {
  // Run it disappears once pressed, so the focus it held would fall to the page.
  const thread = roadsenseSource("WhatIfThread.tsx");
  assert.match(thread, /onClick=\{\(event\) => onRun\(entry\.id, event\.detail === 0\)\}/, "a key press clicks with detail 0, a tap with 1");
  const box = roadsenseSource("WhatIfBox.tsx");
  const inputAt = box.indexOf("<input");
  assert.match(box.slice(inputAt, box.indexOf("/>", inputAt)), /\sref=\{inputRef\}/, "the box hands over its text input");
  const app = roadsenseSource("RoadSenseApp.tsx");
  const boxAt = app.indexOf("<WhatIfBox");
  assert.match(app.slice(boxAt, app.indexOf("/>", boxAt)), /\sinputRef=\{whatIfInputRef\}/, "the page holds that input");
  // Only from the keyboard: focusing a text box after a tap would open a phone's keyboard over the answer.
  assert.match(app, /if \(fromKeyboard\) whatIfInputRef\.current\?\.focus\(\);\s*void whatIfs\.confirm\(subject, id\)/, "focus moves before the run starts");
});

test("thread copy that can hold Spanish terms goes through Explained, so Arabic keeps them left-to-right", () => {
  const source = roadsenseSource("WhatIfThread.tsx");
  assert.match(source, /<Explained\s+text=\{copy\.whatIf\.readAsLabels\[/, "Read as");
  assert.match(source, /<Explained\s+text=\{copy\.whatIf\.notPossible\[/, "not possible here");
  assert.match(source, /<Explained\s+text=\{changeText/, "Before → now");
  assert.match(roadsenseSource("ResultCard.tsx"), /<Explained\s+text=\{text\}/, "the verdict");
});

test("the learner's own words are kept out of analytics capture", () => {
  assert.match(roadsenseSource("WhatIfThread.tsx"), /<p className="[^"]*\bph-no-capture\b[^"]*">\{entry\.words\}<\/p>/);
});

// Typed what-ifs (2026-10-27 redesign). Ruling: the plan named parseStreamLine, which passes
// result lines through untouched; readAnalysisStream is where `refunded` was dropped.
test("a not-applied what-if says whether it was refunded", async () => {
  const done = await readAnalysisStream(ndjson(['{"type":"result","applied":false,"imageDataUrl":null,"result":null,"refunded":true}']), () => {});
  assert.deepEqual(done, { status: "done", outcome: { result: null, applied: false, imageDataUrl: null, refunded: true } });
});

// Typed what-ifs (2026-10-27 redesign): resolving a typed question against the photo, what an
// answer changed, the thread's reducer, and the call that reads the question.
const { resolveTypedWhatIf, answerKey, answerChange, threadReducer, threadBusy, EMPTY_THREAD } = await import("../components/roadsense/view.ts");
/** Imported on first use, so the other tests run even while the module is missing. */
const understandClient = () => import("../components/roadsense/understand-client.ts");

const TYPED_BOX = { x1: 100, y1: 100, x2: 200, y2: 200 };
const TYPED_BASE = { inScope: true, outOfScopeReason: null, junction: "crossroads", egoRoadPaved: true, crossRoadPaved: true, signs: [], lights: [], markings: [], roadUsers: [], unknowns: [] };
const withLight = (state: string) => ({ ...TYPED_BASE, lights: [{ id: "l1", state, appliesTo: "ego", box: TYPED_BOX, confidence: 0.9 }] });
const AMBULANCE_CHIP = { key: "add_emergency_vehicle", edit: { kind: "add_emergency_vehicle" } };

test("resolveTypedWhatIf: none, not possible, not on the example, or run", () => {
  assert.deepEqual(resolveTypedWhatIf({ kind: "none" }, withLight("green"), null), { outcome: "none" });
  assert.deepEqual(resolveTypedWhatIf({ kind: "set_light", to: "red" }, withLight("amber"), null), { outcome: "not_possible", cause: "cant_change" });
  assert.deepEqual(resolveTypedWhatIf({ kind: "set_light" }, withLight("green"), [AMBULANCE_CHIP]), { outcome: "not_on_example" });
  // An example's chip comes from another reading of the photo, so it matches by kind and direction, not fact id.
  const ready = { key: "set_light:l7:red", edit: { kind: "set_light", factId: "l7", to: "red" } };
  assert.deepEqual(resolveTypedWhatIf({ kind: "set_light", to: "red" }, withLight("green"), [AMBULANCE_CHIP, ready]), { outcome: "run", chip: ready });
  assert.deepEqual(resolveTypedWhatIf({ kind: "set_light" }, withLight("green"), null), {
    outcome: "run",
    chip: { key: "set_light:l1:red", edit: { kind: "set_light", factId: "l1", to: "red" } },
  });
});

/** A result with only what answerKey reads. */
function typedResult(certainty: string, obligation: string | null) {
  return {
    certainty,
    facts: TYPED_BASE,
    evidence: [],
    engine: { status: obligation ? "decided" : "insufficient", obligation, ruleIds: [], criticalFactIds: [], missing: [] },
    model: null,
    rules: [],
    costUsd: 0,
    latencyMs: 0,
    modelIds: [],
  };
}

test("answerChange says what a what-if changed", () => {
  assert.deepEqual(answerChange(typedResult("checked", "proceed"), typedResult("checked", "stop_at_light")), {
    changed: true,
    before: "proceed",
    after: "stop_at_light",
  });
  assert.deepEqual(answerChange(typedResult("checked", "proceed"), typedResult("checked", "proceed")), { changed: false });
  assert.deepEqual(answerChange(typedResult("checked", "proceed"), typedResult("not_sure", null)), { changed: true, before: "proceed", after: "not_sure" });
  assert.equal(answerKey(typedResult("disagree", "yield")), "disagree");
  assert.equal(answerKey(typedResult("outside_scope", null)), "outside_scope");
});

test("a reply from before a reset is ignored", () => {
  let state = threadReducer(EMPTY_THREAD, { type: "submit", words: "what if the light turns red" });
  const stale = { generation: state.generation, id: state.entries[0].id };
  state = threadReducer(state, { type: "reset" });
  state = threadReducer(state, { type: "submit", words: "what if an ambulance comes" });
  state = threadReducer(state, { type: "reply", ...stale, reply: { kind: "none" } });
  state = threadReducer(state, { type: "read", ...stale, readAs: "light_red" });
  assert.equal(state.entries.length, 1);
  assert.deepEqual(state.entries[0], { id: state.entries[0].id, words: "what if an ambulance comes", readAs: null, reply: null });
  state = threadReducer(state, { type: "reply", generation: state.generation, id: state.entries[0].id, reply: { kind: "none" } });
  assert.deepEqual(state.entries[0].reply, { kind: "none" });
});

test("submit is ignored while an entry waits", () => {
  let state = threadReducer(EMPTY_THREAD, { type: "submit", words: "one" });
  state = threadReducer(state, { type: "submit", words: "two" });
  assert.equal(state.entries.length, 1);
  assert.equal(threadBusy(state), true);
  state = threadReducer(state, { type: "reply", generation: state.generation, id: state.entries[0].id, reply: { kind: "none" } });
  assert.equal(threadBusy(state), false);
  state = threadReducer(state, { type: "submit", words: "two" });
  assert.equal(state.entries.length, 2);
  assert.equal(state.selectedId, state.entries[1].id, "the newest entry is selected");
});

test("run only acts on the newest confirm", () => {
  const chip = { key: "set_light:l1:red", edit: { kind: "set_light", factId: "l1", to: "red" } };
  let state = threadReducer(EMPTY_THREAD, { type: "submit", words: "one" });
  const first = state.entries[0].id;
  state = threadReducer(state, { type: "reply", generation: state.generation, id: first, reply: { kind: "confirm", chip } });
  state = threadReducer(state, { type: "submit", words: "two" });
  const second = state.entries[1].id;
  state = threadReducer(state, { type: "reply", generation: state.generation, id: second, reply: { kind: "confirm", chip } });
  state = threadReducer(state, { type: "run", generation: state.generation, id: first });
  assert.equal(state.entries[0].reply?.kind, "confirm", "an older confirm can't run");
  state = threadReducer(state, { type: "run", generation: state.generation, id: second });
  assert.equal(state.entries[1].reply, null, "the newest confirm runs");
});

test("a match names its Read-as label only when it names a direction the label needs", () => {
  const { matchLabelKey } = view as unknown as { matchLabelKey: (match: unknown) => string | null };
  assert.equal(matchLabelKey({ kind: "set_light", to: "green" }), "light_green");
  assert.equal(matchLabelKey({ kind: "swap_sign", to: "stop" }), "swap_to_stop");
  assert.equal(matchLabelKey({ kind: "add_pedestrian_on_crossing" }), "add_pedestrian_on_crossing");
  assert.equal(matchLabelKey({ kind: "set_light" }), null);
  assert.equal(matchLabelKey({ kind: "none" }), null);
});

// The thread's requests (final review I1): a question answered after another photo opened must
// not run anything, or it would cancel that photo's own analysis in the shared request slot.
const threadActions = () => import("../components/roadsense/thread-actions.ts");
const THREAD_SCENE = { id: "lights-2", title: "Green light", imagePath: "/scene.webp", thumbPath: "/thumb.webp", whatIfs: [{ key: "set_light:l1:red", edit: { kind: "set_light", factId: "l1", to: "red" } }] };
const THREAD_BASE = { ...typedResult("checked", "proceed"), facts: withLight("green") };
const RED_RESULT = { ...typedResult("checked", "stop_at_light"), facts: withLight("red") };

/** createThreadActions with a thread held in a variable, a run that records its requests, and an understanding step released on demand. */
function threadHarness(match: unknown) {
  let state = EMPTY_THREAD;
  let release = () => {};
  const understood = new Promise<void>((resolve) => {
    release = resolve;
  });
  const runs: { url: string; body: Record<string, unknown> }[] = [];
  const events: { name: string; params?: Record<string, unknown> }[] = [];
  const deps = {
    locale: "en",
    getState: () => state,
    dispatch: (action: unknown) => {
      state = threadReducer(state, action);
    },
    run: async (url: string, body: Record<string, unknown>) => {
      runs.push({ url, body });
      return { status: "done", outcome: { result: RED_RESULT, imagePath: "/edited.webp" } };
    },
    understand: async () => {
      await understood;
      return { ok: true, match };
    },
    onEvent: (name: string, params?: Record<string, unknown>) => {
      events.push({ name, params });
    },
  };
  return { deps, runs, events, release, state: () => state };
}

test("a typed question answered after another photo opened runs nothing", async () => {
  const { createThreadActions } = await threadActions();
  const h = threadHarness({ kind: "set_light", to: "red" });
  const pending = createThreadActions(h.deps).ask({ kind: "scene", scene: THREAD_SCENE, base: THREAD_BASE }, "what if the light turns red");
  h.deps.dispatch({ type: "reset" });
  h.release();
  await pending;
  assert.deepEqual(h.runs, [], "no request may take the new photo's slot");
  assert.deepEqual(h.state().entries, []);
  assert.deepEqual(h.events, []);
});

test("a typed question on an example runs its pre-generated what-if", async () => {
  const { createThreadActions } = await threadActions();
  const h = threadHarness({ kind: "set_light", to: "red" });
  h.release();
  await createThreadActions(h.deps).ask({ kind: "scene", scene: THREAD_SCENE, base: THREAD_BASE }, "what if the light turns red");
  assert.deepEqual(h.runs, [{ url: "/api/roadsense/whatif", body: { sceneId: "lights-2", editKey: "set_light:l1:red", locale: "en" } }]);
  const [entry] = h.state().entries;
  assert.equal(entry.readAs, "light_red");
  assert.equal(entry.reply?.kind, "answer");
  assert.deepEqual(h.events.at(-1), { name: "roadsense_whatif_typed", params: { source: "scene", match: "set_light", resolution: "run" } });
});

test("a typed question on the learner's photo asks first, then runs exactly { kind, to }", async () => {
  const { createThreadActions } = await threadActions();
  const h = threadHarness({ kind: "set_light", to: "red" });
  h.release();
  const actions = createThreadActions(h.deps);
  const subject = { kind: "upload", photo: "data:image/jpeg;base64,AAAA", base: THREAD_BASE };
  await actions.ask(subject, "what if the light turns red");
  assert.equal(h.state().entries[0].reply?.kind, "confirm");
  assert.deepEqual(h.runs, [], "nothing runs before Run it");
  await actions.confirm(subject, h.state().entries[0].id);
  assert.deepEqual(h.runs, [{ url: "/api/roadsense/whatif", body: { imageBase64: "data:image/jpeg;base64,AAAA", edit: { kind: "set_light", to: "red" }, locale: "en" } }]);
  assert.equal(h.state().entries[0].reply?.kind, "answer");
});

test("select null shows the original photo", () => {
  let state = threadReducer(EMPTY_THREAD, { type: "submit", words: "one" });
  assert.equal(state.selectedId, state.entries[0].id);
  state = threadReducer(state, { type: "select", id: null });
  assert.equal(state.selectedId, null);
});

/** A fetch stand-in that answers once and records the request. */
function stubFetch(status: number, body: unknown, calls: { url: string; init: RequestInit }[] = []) {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

test("askUnderstand posts the words and reads the match", async () => {
  const { askUnderstand } = await understandClient();
  const calls: { url: string; init: RequestInit }[] = [];
  const reply = await askUnderstand("what if the light turns red", "en", stubFetch(200, { match: { kind: "set_light", to: "red" } }, calls));
  assert.deepEqual(reply, { ok: true, match: { kind: "set_light", to: "red" } });
  assert.equal(calls[0].url, "/api/roadsense/whatif/understand");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(new Headers(calls[0].init.headers).get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { text: "what if the light turns red", locale: "en" });
});

test("askUnderstand turns refusals and failures into replies", async () => {
  const { askUnderstand } = await understandClient();
  assert.deepEqual(await askUnderstand("x", "en", stubFetch(503, { error: "paused", message: "Paused" })), { ok: false, reason: "paused", message: null });
  assert.deepEqual(await askUnderstand("x", "en", stubFetch(429, { error: "limit", message: "50 typed questions" })), {
    ok: false,
    reason: "limited",
    message: "50 typed questions",
  });
  assert.deepEqual(await askUnderstand("x", "en", stubFetch(500, { error: "internal", message: "boom" })), { ok: false, reason: "error", message: null });
  assert.deepEqual(await askUnderstand("x", "en", stubFetch(200, { match: { kind: "fly" } })), { ok: false, reason: "error", message: null });
  assert.deepEqual(await askUnderstand("x", "en", stubFetch(200, "not json")), { ok: false, reason: "error", message: null });
  const offline = (async () => {
    throw new TypeError("Failed to fetch");
  }) as unknown as typeof fetch;
  assert.deepEqual(await askUnderstand("x", "en", offline), { ok: false, reason: "error", message: null });
});
