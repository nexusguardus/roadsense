// The pipeline runs perception, the rule engine, the evidence check and the
// model's decision, and only calls an answer "checked" when all of them agree.
// A stand-in client replays canned model answers; the engine and corpus are real.
import { test } from "node:test";
import assert from "node:assert/strict";
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

const { analyzeScene, certaintyOf, RoadsenseTimeoutError } = await import("../lib/roadsense/pipeline.ts");
const { corpusFrom } = await import("../lib/roadsense/corpus.ts");
const { decideObligation } = await import("../lib/roadsense/engine.ts");

const corpus = corpusFrom(JSON.parse(readFileSync(new URL("data/roadsense/corpus.json", ROOT), "utf8")));
const SAM_SIGN = readFileSync(new URL("tests/fixtures/roadsense/sam-traffic-sign.txt", ROOT), "utf8");
const IMAGE = "data:image/webp;base64,AAAA";

/** The Task 1 spike scene: a yield sign for the learner and a car coming from the right. */
const FACTS = {
  inScope: true,
  outOfScopeReason: null,
  junction: "crossroads",
  egoRoadPaved: true,
  crossRoadPaved: true,
  signs: [{ id: "s1", kind: "yield", appliesTo: "ego", box: { x1: 670, y1: 284, x2: 737, y2: 394 }, confidence: 0.9 }],
  lights: [],
  markings: [],
  roadUsers: [
    { id: "u1", kind: "car", position: "from_right", emergencyLightsOn: false, box: { x1: 820, y1: 420, x2: 990, y2: 560 }, confidence: 0.85 },
  ],
  unknowns: [],
};
const DECISION = {
  obligation: "yield",
  priorityTo: ["u1"],
  rationale: "The inverted triangle is a yield sign (ceda el paso) for your approach.",
  temptingWrongAnswer: "Go first because the car is still far away.",
  whyWrong: "A yield sign means letting every vehicle on the other road go first.",
  ruleIds: ["rgc-56-5"],
};
/** What retrieval gives the model for FACTS: the engine's rules, then arts. 58.1, 59.1 and 57.1. */
const RETRIEVED = ["rgc-56-1", "rgc-56-5", "rgc-133-1", "rgc-58-1", "rgc-59-1", "rgc-57-1"];

interface Options {
  perception?: unknown;
  decision?: unknown;
  verify?: unknown;
  sam?: Record<string, string>;
  samDelayMs?: number;
}

/** A MetaClient stand-in: every model answer is canned, every call is recorded. */
function fakeClient(options: Options = {}) {
  const calls = { chat: [] as string[], segment: [] as string[], events: [] as string[] };
  const replies: Record<string, [unknown, number]> = {
    scene_facts: [options.perception ?? FACTS, 0.01],
    decision: [options.decision ?? DECISION, 0.02],
    fact_checks: [options.verify ?? null, 0.005],
  };
  const client = {
    sparkModel: "muse-spark-1.3",
    async chatJson({ schemaName }: { schemaName: string }) {
      calls.chat.push(schemaName);
      calls.events.push(`${schemaName}:start`);
      const [json, costUsd] = replies[schemaName];
      return { json, costUsd };
    },
    async segment({ concept }: { concept: string }) {
      calls.segment.push(concept);
      calls.events.push("segment:start");
      await new Promise((done) => setTimeout(done, options.samDelayMs ?? 0));
      calls.events.push("segment:end");
      return { text: (options.sam ?? { "traffic sign": SAM_SIGN })[concept] ?? "", costUsd: 0.0025 };
    },
    async editImage() {
      throw new Error("unused");
    },
    async generateImage() {
      throw new Error("unused");
    },
  };
  return { client, calls };
}

const deps = (client: unknown, extra: Record<string, unknown> = {}) => ({ client, corpus, evidenceMode: "sam", budgetMs: 25_000, ...extra });
const INPUT = { imageDataUrl: IMAGE, locale: "en" };
const withSign = (patch: Record<string, unknown>) => ({ ...FACTS, signs: [{ ...FACTS.signs[0], ...patch }] });
const CONFIRMED = [{ factId: "s1", concept: "traffic sign", confirmed: true, factBox: FACTS.signs[0].box, matchedBox: FACTS.signs[0].box, overlap: 1 }];

test("checked when engine, model and evidence agree", async () => {
  const { client } = fakeClient();
  const result = await analyzeScene(deps(client), INPUT);
  assert.equal(result.certainty, "checked");
  assert.equal(result.engine.obligation, "yield");
  assert.equal(result.model?.obligation, "yield");
  assert.deepEqual(result.evidence.map((e) => [e.factId, e.confirmed]), [["s1", true]]);
  assert.deepEqual(result.rules.map((r) => r.id), RETRIEVED);
});

test("not sure when SAM does not confirm the deciding sign", async () => {
  const { client } = fakeClient({ sam: {} });
  const result = await analyzeScene(deps(client), INPUT);
  assert.equal(result.certainty, "not_sure");
  assert.equal(result.evidence[0].confirmed, false);
});

test("low-confidence critical fact is not sure", async () => {
  const { client } = fakeClient({ perception: withSign({ confidence: 0.4 }) });
  const result = await analyzeScene(deps(client), INPUT);
  assert.equal(result.certainty, "not_sure");
});

test("disagree when the model's obligation differs", async () => {
  const { client } = fakeClient({ decision: { ...DECISION, obligation: "proceed" } });
  const result = await analyzeScene(deps(client), INPUT);
  assert.equal(result.certainty, "disagree");
});

test("not sure without calling the model when the engine lacks a fact", async () => {
  const { client, calls } = fakeClient({ perception: { ...FACTS, unknowns: ["junction_unclear"] } });
  const result = await analyzeScene(deps(client), INPUT);
  assert.equal(result.certainty, "not_sure");
  assert.equal(result.model, null);
  assert.deepEqual(result.engine.missing, ["junction_unclear"]);
  assert.equal(calls.chat.length, 1);
  assert.equal(calls.segment.length, 0);
});

test("not_spain is outside scope and skips SAM", async () => {
  const { client, calls } = fakeClient({ perception: { ...FACTS, inScope: false, outOfScopeReason: "not_spain" } });
  const result = await analyzeScene(deps(client), INPUT);
  assert.equal(result.certainty, "outside_scope");
  assert.equal(calls.chat.length, 1);
  assert.equal(calls.segment.length, 0);
});

test("given facts skip perception", async () => {
  const { client, calls } = fakeClient();
  const result = await analyzeScene(deps(client), { ...INPUT, facts: FACTS });
  assert.deepEqual(calls.chat, ["decision"]);
  assert.equal(result.certainty, "checked");
});

test("reports stages in order", async () => {
  const { client } = fakeClient();
  const stages: string[] = [];
  await analyzeScene(deps(client), INPUT, (stage) => stages.push(stage));
  assert.deepEqual(stages, ["perceive", "check", "confirm", "retrieve", "decide"]);
});

test("throws RoadsenseTimeoutError past the budget", async () => {
  const { client, calls } = fakeClient();
  const now = () => (calls.chat.length > 0 ? 26_000 : 0);
  await assert.rejects(analyzeScene(deps(client, { now }), INPUT), RoadsenseTimeoutError);
  assert.equal(calls.segment.length, 0);
});

test("adds up cost across calls", async () => {
  const { client } = fakeClient();
  const result = await analyzeScene(deps(client), INPUT);
  assert.ok(Math.abs(result.costUsd - (0.01 + 0.0025 + 0.02)) < 1e-9);
});

test("dual evidence mode never calls SAM", async () => {
  const verify = { checks: [{ factId: "s1", present: true, box: { x1: 668, y1: 280, x2: 738, y2: 392 } }] };
  const { client, calls } = fakeClient({ verify });
  const result = await analyzeScene(deps(client, { evidenceMode: "dual" }), INPUT);
  assert.equal(calls.segment.length, 0);
  assert.equal(result.certainty, "checked");
  assert.deepEqual(result.modelIds, ["muse-spark-1.3"]);
});

test("lists the models it used", async () => {
  const { client } = fakeClient();
  const result = await analyzeScene(deps(client), INPUT);
  assert.deepEqual(result.modelIds, ["muse-spark-1.3", "sam-3.1"]);
});

test("checks the evidence while the model decides", async () => {
  const { client, calls } = fakeClient({ samDelayMs: 20 });
  await analyzeScene(deps(client), INPUT);
  assert.ok(calls.events.indexOf("decision:start") < calls.events.indexOf("segment:end"));
});

test("a decision that fails validation is not sure", async () => {
  const { client } = fakeClient({ decision: { ...DECISION, ruleIds: [] } });
  const result = await analyzeScene(deps(client), INPUT);
  assert.equal(result.model, null);
  assert.equal(result.certainty, "not_sure");
  // The rejected decision was billed: perception 0.01, SAM 0.0025 and the decision 0.02.
  assert.ok(Math.abs(result.costUsd - 0.0325) < 1e-9, String(result.costUsd));
});

test("a failed evidence check waits for the decision call before the error surfaces", async () => {
  const events: string[] = [];
  const client = {
    sparkModel: "muse-spark-1.3",
    async chatJson({ schemaName }: { schemaName: string }) {
      if (schemaName !== "decision") return { json: FACTS, costUsd: 0.01 };
      await new Promise((done) => setTimeout(done, 30));
      events.push("decision:end");
      return { json: DECISION, costUsd: 0.02 };
    },
    async segment() {
      throw new Error("SAM is down");
    },
    async editImage() {
      throw new Error("unused");
    },
    async generateImage() {
      throw new Error("unused");
    },
  };
  // The spend is read when the error surfaces, so the other call must have finished by then.
  await assert.rejects(analyzeScene(deps(client), INPUT), /SAM is down/);
  assert.deepEqual(events, ["decision:end"]);
});

test("not sure when a critical fact has no evidence", () => {
  assert.equal(certaintyOf(FACTS, decideObligation(FACTS), DECISION, [], RETRIEVED), "not_sure");
});

test("an answer that rests on nothing the photo can confirm is never checked", () => {
  // An empty unsigned crossroads: "go" rests on the absence of traffic, which SAM can't confirm.
  const empty = { ...FACTS, signs: [], roadUsers: [] };
  const engine = decideObligation(empty);
  assert.equal(engine.status, "decided");
  assert.deepEqual(engine.criticalFactIds, []);
  const decision = { ...DECISION, obligation: engine.obligation, priorityTo: [], ruleIds: engine.ruleIds };
  assert.equal(certaintyOf(empty, engine, decision, [], [...engine.ruleIds, "rgc-59-1"]), "not_sure");
});

test("disagree when the model cites none of the engine's rules or a rule it was not given", () => {
  const engine = decideObligation(FACTS);
  assert.equal(certaintyOf(FACTS, engine, DECISION, CONFIRMED, RETRIEVED), "checked");
  assert.equal(certaintyOf(FACTS, engine, { ...DECISION, ruleIds: ["rgc-58-1"] }, CONFIRMED, RETRIEVED), "disagree");
  assert.equal(certaintyOf(FACTS, engine, { ...DECISION, ruleIds: ["rgc-56-5", "rgc-57-1-c"] }, CONFIRMED, RETRIEVED), "disagree");
});
