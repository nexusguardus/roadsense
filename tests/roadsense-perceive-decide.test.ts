// Perception turns the photo into scene facts; the model's decision may only cite
// the rule excerpts it was given. Both run on a stand-in client that replays
// canned answers, so these checks cover parsing, retries and prompt content.
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

const { perceiveScene } = await import("../lib/roadsense/perceive.ts");
const { decideWithModel } = await import("../lib/roadsense/decide.ts");
const { PERCEPTION_SYSTEM, DECISION_SYSTEM } = await import("../lib/roadsense/prompts.ts");
const { corpusFrom, rulesByIds } = await import("../lib/roadsense/corpus.ts");
const { RoadsenseValidationError } = await import("../lib/roadsense/errors.ts");

const corpus = corpusFrom(JSON.parse(readFileSync(new URL("data/roadsense/corpus.json", ROOT), "utf8")));
const RULES = rulesByIds(corpus, ["rgc-56-1", "rgc-56-5", "rgc-57-1"]);
const IMAGE = "data:image/webp;base64,AAAA";

const FACTS = {
  inScope: true,
  outOfScopeReason: null,
  junction: "crossroads",
  egoRoadPaved: true,
  crossRoadPaved: true,
  signs: [{ id: "s1", kind: "yield", appliesTo: "ego", box: { x1: 643, y1: 263, x2: 720, y2: 373 }, confidence: 0.92 }],
  lights: [],
  markings: [],
  roadUsers: [{ id: "u1", kind: "car", position: "from_right", emergencyLightsOn: false, box: { x1: 660, y1: 450, x2: 790, y2: 545 }, confidence: 0.9 }],
  unknowns: [],
};
const DECISION = {
  obligation: "yield",
  priorityTo: ["u1"],
  rationale: "Hay una señal de ceda el paso en tu acceso.",
  temptingWrongAnswer: "Pasar porque el coche viene despacio.",
  whyWrong: "El ceda el paso obliga a dejar pasar a quien circula por la vía preferente.",
  ruleIds: ["rgc-56-5"],
};

/** A MetaClient stand-in: chatJson replays `replies` in order (an Error is thrown) and records each request. */
function fakeClient(replies: unknown[]) {
  const calls: any[] = [];
  const unused = async () => {
    throw new Error("not used in this test");
  };
  const client = {
    async chatJson(args: unknown) {
      calls.push(args);
      const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
      if (reply instanceof Error) throw reply;
      return { json: reply, costUsd: 0.01 };
    },
    segment: unused,
    editImage: unused,
    generateImage: unused,
  };
  return { client, calls };
}

test("perception parses the model's facts", async () => {
  const { client, calls } = fakeClient([FACTS]);
  const { facts, costUsd } = await perceiveScene(client, IMAGE);
  assert.deepEqual(facts, FACTS);
  assert.equal(costUsd, 0.01);
  assert.equal(calls[0].imageDataUrl, IMAGE);
  assert.equal(calls[0].schemaName, "scene_facts");
});

test("perception retries once on invalid output, then succeeds", async () => {
  const { client, calls } = fakeClient([{ junction: "spaghetti" }, FACTS]);
  const { facts, costUsd } = await perceiveScene(client, IMAGE);
  assert.equal(calls.length, 2);
  assert.equal(facts.junction, "crossroads");
  assert.equal(costUsd, 0.02);
});

test("perception retries when the reply is not JSON", async () => {
  const { client, calls } = fakeClient([new RoadsenseValidationError("not JSON"), FACTS]);
  await perceiveScene(client, IMAGE);
  assert.equal(calls.length, 2);
});

test("perception gives up after a second invalid output", async () => {
  const { client } = fakeClient([{ junction: "spaghetti" }]);
  await assert.rejects(perceiveScene(client, IMAGE), RoadsenseValidationError);
});

test("perception prompt asks for country cues", () => {
  assert.match(PERCEPTION_SYSTEM, /not_spain/);
  assert.match(PERCEPTION_SYSTEM, /drives on the right/i);
});

test("perception prompt carries the rule engine's assumptions", () => {
  assert.match(PERCEPTION_SYSTEM, /approaching the entry/i);
  assert.match(PERCEPTION_SYSTEM, /surface_unclear/);
  assert.match(PERCEPTION_SYSTEM, /on_crossing_ahead/);
  assert.match(PERCEPTION_SYSTEM, /0-1000/);
});

test("decision prompt shares the engine's give-way convention", () => {
  // An empty roundabout made one locale answer "proceed" against the engine's standing "yield" (RULES.md notes).
  assert.match(DECISION_SYSTEM, /even if nobody is in sight/i);
});

test("perception prompt makes the model look for a hidden sign on the learner's approach", () => {
  // Standard mode called a crossroads with its sign behind a lorry "no junction, nothing hidden".
  assert.match(PERCEPTION_SYSTEM, /where a sign for their approach would stand/);
  assert.match(PERCEPTION_SYSTEM, /partly hidden by a vehicle is still a junction/);
  // The same check must not flag a clear, empty spot: that approach simply has no sign.
  assert.match(PERCEPTION_SYSTEM, /in clear view and empty/);
});

test("perception prompt keeps to the junction directly ahead", () => {
  // A STOP for the next junction down the road must not decide this one, nor count as hidden signage.
  assert.match(PERCEPTION_SYSTEM, /directly ahead/i);
  assert.match(PERCEPTION_SYSTEM, /further down the road/i);
});

test("decision schema enum equals the retrieved rule ids", async () => {
  const { client, calls } = fakeClient([DECISION]);
  await decideWithModel(client, FACTS, RULES, "es");
  assert.deepEqual(calls[0].schema.properties.ruleIds.items.enum, ["rgc-56-1", "rgc-56-5", "rgc-57-1"]);
  assert.equal(calls[0].imageDataUrl, undefined);
});

test("decision returns the parsed decision and its cost", async () => {
  const { client } = fakeClient([DECISION]);
  assert.deepEqual(await decideWithModel(client, FACTS, RULES, "es"), { decision: DECISION, costUsd: 0.01 });
});

test("decision rejects rule ids outside the retrieved set", async () => {
  const { client } = fakeClient([{ ...DECISION, ruleIds: ["rgc-69"] }]);
  await assert.rejects(decideWithModel(client, FACTS, RULES, "es"), RoadsenseValidationError);
});

test("decision rejects an unknown obligation", async () => {
  const { client } = fakeClient([{ ...DECISION, obligation: "maybe" }]);
  await assert.rejects(decideWithModel(client, FACTS, RULES, "es"), RoadsenseValidationError);
});

test("decision names the learner's language", async () => {
  const { client, calls } = fakeClient([DECISION]);
  await decideWithModel(client, FACTS, RULES, "ar");
  assert.match(calls[0].user, /Arabic/);
});

test("a Spanish explanation writes Spanish terms plainly, not in brackets", async () => {
  const { client, calls } = fakeClient([DECISION, DECISION]);
  await decideWithModel(client, FACTS, RULES, "es");
  await decideWithModel(client, FACTS, RULES, "en");
  assert.match(calls[0].user, /without brackets/);
  // Other languages keep the brackets (and their recorded evaluation requests stay the same).
  assert.doesNotMatch(calls[1].user, /brackets/);
});

test("decision prompt gives the facts and the excerpts", async () => {
  const { client, calls } = fakeClient([DECISION]);
  await decideWithModel(client, FACTS, RULES, "en");
  assert.ok(calls[0].user.includes(RULES[1].excerptEs));
  assert.ok(calls[0].user.includes('"junction":"crossroads"'));
});
