// The rule engine decides what the learner must do from perceived facts alone,
// and only that decision can earn the "checked" badge. Each case is one row of
// the decision table in docs/roadsense/RULES.md, cited to the RGC corpus.
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

const { decideObligation } = await import("../lib/roadsense/engine.ts");
const { retrieveRuleIds } = await import("../lib/roadsense/retrieve.ts");
const { RULE_IDS } = await import("../lib/roadsense/corpus.ts");

const BOX = { x1: 100, y1: 100, x2: 200, y2: 200 };
const sign = (id: string, kind: string, appliesTo = "ego") => ({ id, kind, appliesTo, box: BOX, confidence: 0.9 });
const light = (id: string, state: string, appliesTo = "ego") => ({ id, state, appliesTo, box: BOX, confidence: 0.9 });
const marking = (id: string, kind: string, appliesTo = "ego") => ({ id, kind, appliesTo, box: BOX, confidence: 0.9 });
const user = (id: string, kind: string, position: string, emergencyLightsOn = false) => ({
  id,
  kind,
  position,
  emergencyLightsOn,
  box: BOX,
  confidence: 0.9,
});
/** An in-scope, fully paved crossroads with nothing in it. */
const scene = (partial: Record<string, unknown>) => ({
  inScope: true,
  outOfScopeReason: null,
  junction: "crossroads",
  egoRoadPaved: true,
  crossRoadPaved: true,
  signs: [],
  lights: [],
  markings: [],
  roadUsers: [],
  unknowns: [],
  ...partial,
});

const CASES: [string, Record<string, unknown>, Record<string, unknown>][] = [
  ["unsigned crossroads, car from the right", { roadUsers: [user("u1", "car", "from_right")] }, { obligation: "yield", ruleIds: ["rgc-57-1"], criticalFactIds: ["u1"] }],
  ["unsigned crossroads, car from the left only", { roadUsers: [user("u1", "car", "from_left")] }, { obligation: "proceed", ruleIds: ["rgc-57-1"] }],
  ["STOP sign for me", { signs: [sign("s1", "stop")] }, { obligation: "stop_and_yield", ruleIds: ["rgc-56-1", "rgc-56-5", "rgc-133-1"], criticalFactIds: ["s1"] }],
  ["yield sign for me", { signs: [sign("s1", "yield")] }, { obligation: "yield", ruleIds: ["rgc-56-1", "rgc-56-5", "rgc-133-1"] }],
  ["a yield sign for the road on the left makes its drivers give way to me", { signs: [sign("s1", "yield", "left")], roadUsers: [user("u1", "car", "from_left")] }, { obligation: "proceed", ruleIds: ["rgc-56-1", "rgc-56-5"], criticalFactIds: ["s1"] }],
  ["a STOP sign for the road on the right gives me priority over its traffic", { signs: [sign("s1", "stop", "right")], roadUsers: [user("u1", "car", "from_right")] }, { obligation: "proceed", ruleIds: ["rgc-56-1", "rgc-56-5"], criticalFactIds: ["s1"] }],
  ["a yield triangle painted on the road on the right gives me priority", { markings: [marking("m1", "yield_triangle", "right")], roadUsers: [user("u1", "car", "from_right")] }, { obligation: "proceed", ruleIds: ["rgc-56-1", "rgc-56-5"], criticalFactIds: ["m1"] }],
  ["a yield line alone on the road on the right leaves priority to the right", { markings: [marking("m1", "yield_line", "right")], roadUsers: [user("u1", "car", "from_right")] }, { obligation: "yield", ruleIds: ["rgc-57-1"], criticalFactIds: ["u1"] }],
  ["a STOP for the road ahead does not give me priority over the right", { signs: [sign("s1", "stop", "ahead")], roadUsers: [user("u1", "car", "from_right")] }, { obligation: "yield", ruleIds: ["rgc-57-1"] }],
  ["other entries' yield signs do not change a roundabout entry", { junction: "roundabout", signs: [sign("s1", "yield", "left")], roadUsers: [user("u1", "car", "inside_roundabout")] }, { obligation: "yield", ruleIds: ["rgc-57-1-c"] }],
  ["STOP and yield signs together, the stricter wins", { signs: [sign("s1", "stop"), sign("s2", "yield")] }, { obligation: "stop_and_yield", ruleIds: ["rgc-56-1", "rgc-56-5", "rgc-133-1", "rgc-133-2"] }],
  ["priority road sign", { signs: [sign("s1", "priority_road")], roadUsers: [user("u1", "car", "from_right")] }, { obligation: "proceed", ruleIds: ["rgc-56-1", "rgc-56-4"] }],
  ["green light beats a yield sign", { lights: [light("l1", "green")], signs: [sign("s1", "yield")] }, { obligation: "proceed", ruleIds: ["rgc-56-3", "anexo-i-light-green", "rgc-133-1", "rgc-59-1"], criticalFactIds: ["l1"] }],
  ["red light at a mid-block crossing", { junction: "none", lights: [light("l1", "red")] }, { obligation: "stop_at_light", ruleIds: ["anexo-i-light-red", "rgc-133-1"] }],
  ["a STOP sign with no junction is out of scope", { junction: "none", signs: [sign("s1", "stop")] }, { status: "out_of_scope" }],
  // Final review: the crossing road's own sign binds only its drivers (arts. 56.5, 57.1).
  ["a STOP for the road on the left doesn't give me priority over an unsigned road on the right", { signs: [sign("s1", "stop", "left")], roadUsers: [user("u1", "car", "from_right")] }, { obligation: "yield", ruleIds: ["rgc-57-1"], criticalFactIds: ["u1"] }],
  ["a painted triangle on the left road doesn't settle an unsigned right road", { markings: [marking("m1", "yield_triangle", "left")], roadUsers: [user("u1", "car", "from_right")] }, { obligation: "yield", ruleIds: ["rgc-57-1"] }],
  ["with only the left road signed, a hidden right approach is not settled", { signs: [sign("s1", "stop", "left")], unknowns: ["right_approach_hidden"] }, { status: "insufficient", missing: ["right_approach_hidden"] }],
  ["a priority-road sign for the crossing road is not settled without a sign of my own", { signs: [sign("s1", "priority_road", "left")] }, { status: "insufficient", obligation: null }],
  ["hidden signage outranks a pedestrian on the crossing", { markings: [marking("m1", "zebra_crossing")], roadUsers: [user("p1", "pedestrian", "on_crossing_ahead")], unknowns: ["ego_signage_hidden"] }, { status: "insufficient", missing: ["ego_signage_hidden"] }],
  ["a zebra crossing on another road doesn't make me give way to a pedestrian", { markings: [marking("m1", "zebra_crossing", "left")], roadUsers: [user("p1", "pedestrian", "on_crossing_ahead")] }, { status: "insufficient" }],
  ["an out-of-scope reason means out of scope, whatever inScope says", { outOfScopeReason: "not_spain", signs: [sign("s1", "stop")] }, { status: "out_of_scope" }],
  ["hidden signage outranks a visible sign", { signs: [sign("s1", "stop")], unknowns: ["ego_signage_hidden"] }, { status: "insufficient", missing: ["ego_signage_hidden"] }],
  ["a visible light still decides when other signage is hidden", { lights: [light("l1", "red")], unknowns: ["ego_signage_hidden"] }, { obligation: "stop_at_light" }],
  ["STOP sign and a pedestrian on the crossing", { signs: [sign("s1", "stop")], markings: [marking("m1", "zebra_crossing")], roadUsers: [user("p1", "pedestrian", "on_crossing_ahead")] }, { obligation: "stop_and_yield", ruleIds: ["rgc-56-1", "rgc-56-5", "rgc-133-1", "rgc-65-1-a", "anexo-i-m-4-3"], criticalFactIds: ["s1", "p1"] }],
  ["a pedestrian with no visible crossing is not settled", { roadUsers: [user("p1", "pedestrian", "on_crossing_ahead")] }, { status: "insufficient" }],
  ["priority road sign beats a STOP marking", { signs: [sign("s1", "priority_road")], markings: [marking("m1", "stop_word")] }, { obligation: "proceed", ruleIds: ["rgc-56-1", "rgc-56-4", "rgc-133-1", "rgc-133-2"] }],
  ["flashing amber cites its own rule", { lights: [light("l1", "amber_flashing")], signs: [sign("s1", "yield")] }, { obligation: "yield", ruleIds: ["rgc-56-1", "rgc-56-5", "rgc-133-1", "anexo-i-light-amber-flashing"] }],
  ["green light with a pedestrian on the crossing is not settled", { lights: [light("l1", "green")], roadUsers: [user("p1", "pedestrian", "on_crossing_ahead")] }, { status: "insufficient", obligation: null }],
  ["red light", { lights: [light("l1", "red")] }, { obligation: "stop_at_light", ruleIds: ["rgc-56-3", "anexo-i-light-red", "rgc-133-1"] }],
  ["steady amber light", { lights: [light("l1", "amber")] }, { obligation: "stop_at_light", ruleIds: ["rgc-56-3", "anexo-i-light-amber", "rgc-133-1"] }],
  ["flashing amber falls through to the yield sign", { lights: [light("l1", "amber_flashing")], signs: [sign("s1", "yield")] }, { obligation: "yield" }],
  ["sign beats a contradicting marking", { signs: [sign("s1", "stop")], markings: [marking("m1", "yield_triangle")] }, { obligation: "stop_and_yield", ruleIds: ["rgc-56-1", "rgc-56-5", "rgc-133-1", "rgc-133-2"] }],
  ["yield sign beats a stricter STOP marking", { signs: [sign("s1", "yield")], markings: [marking("m1", "stop_word")] }, { obligation: "yield", ruleIds: ["rgc-56-1", "rgc-56-5", "rgc-133-1", "rgc-133-2"] }],
  ["STOP marking without a sign", { markings: [marking("m1", "stop_word"), marking("m2", "stop_line")] }, { obligation: "stop_and_yield", ruleIds: ["rgc-56-1", "rgc-56-5", "anexo-i-m-6-3", "anexo-i-m-4-1"], criticalFactIds: ["m1"] }],
  ["yield marking without a sign", { markings: [marking("m1", "yield_triangle")] }, { obligation: "yield", ruleIds: ["rgc-56-1", "rgc-56-5", "anexo-i-m-6-5"] }],
  ["a stop line alone points to a sign I cannot see", { markings: [marking("m1", "stop_line")] }, { status: "insufficient", missing: ["ego_signage_hidden"] }],
  ["a yield line alone falls back to the general rule", { markings: [marking("m1", "yield_line")], roadUsers: [user("u1", "car", "from_right")] }, { obligation: "yield", ruleIds: ["rgc-57-1"] }],
  ["pedestrian on a zebra", { markings: [marking("m1", "zebra_crossing")], roadUsers: [user("p1", "pedestrian", "on_crossing_ahead")] }, { obligation: "yield_to_pedestrians", ruleIds: ["rgc-65-1-a", "anexo-i-m-4-3"], criticalFactIds: ["p1"] }],
  ["roundabout entry", { junction: "roundabout", roadUsers: [user("u1", "car", "inside_roundabout")] }, { obligation: "yield", ruleIds: ["rgc-57-1-c"], criticalFactIds: ["u1"] }],
  ["tram crossing", { roadUsers: [user("t1", "tram", "from_left")] }, { obligation: "yield", ruleIds: ["rgc-57-1-b"], criticalFactIds: ["t1"] }],
  ["my road unpaved, the other paved", { egoRoadPaved: false, crossRoadPaved: true }, { obligation: "yield", ruleIds: ["rgc-57-1-a"] }],
  ["my road paved, the other unpaved", { egoRoadPaved: true, crossRoadPaved: false, roadUsers: [user("u1", "car", "from_right")] }, { obligation: "proceed", ruleIds: ["rgc-57-1-a"] }],
  ["ambulance with lights beats a green light", { lights: [light("l1", "green")], roadUsers: [user("e1", "emergency_vehicle", "from_left", true)] }, { obligation: "yield_to_emergency_vehicle", ruleIds: ["rgc-67-1", "rgc-69"], criticalFactIds: ["e1"] }],
  ["ambulance without lights is an ordinary vehicle", { roadUsers: [user("e1", "emergency_vehicle", "from_left")] }, { obligation: "proceed", ruleIds: ["rgc-57-1"] }],
  ["hidden sign on my approach", { unknowns: ["ego_signage_hidden"] }, { status: "insufficient", missing: ["ego_signage_hidden"] }],
  ["right approach hidden", { unknowns: ["right_approach_hidden"] }, { status: "insufficient", missing: ["right_approach_hidden"] }],
  ["junction unclear", { unknowns: ["junction_unclear"], signs: [sign("s1", "stop")] }, { status: "insufficient", missing: ["junction_unclear"] }],
  ["light state unclear", { lights: [light("l1", "red")], unknowns: ["light_state_unclear"] }, { status: "insufficient", missing: ["light_state_unclear"] }],
  ["no junction", { junction: "none" }, { status: "out_of_scope" }],
  ["outside Spain", { inScope: false, outOfScopeReason: "not_spain" }, { status: "out_of_scope", ruleIds: [] }],
];

for (const [name, partial, expected] of CASES) {
  test(name, () => {
    const verdict = decideObligation(scene(partial));
    const wanted = { status: "decided", ...expected };
    for (const [key, value] of Object.entries(wanted)) {
      assert.deepEqual((verdict as Record<string, unknown>)[key], value, `${name}: ${key}`);
    }
  });
}

test("the engine only cites rules in the corpus", () => {
  for (const [, partial] of CASES) {
    for (const id of decideObligation(scene(partial)).ruleIds) assert.ok((RULE_IDS as readonly string[]).includes(id), id);
  }
});

test("retrieval covers every id the engine cites", () => {
  for (const [name, partial] of CASES) {
    const facts = scene(partial);
    const retrieved = retrieveRuleIds(facts);
    for (const id of decideObligation(facts).ruleIds) assert.ok(retrieved.includes(id), `${name}: ${id}`);
  }
});

test("retrieval adds how to give way and not blocking the junction for yield kinds", () => {
  const retrieved = retrieveRuleIds(scene({ signs: [sign("s1", "yield")] }));
  assert.ok(retrieved.includes("rgc-58-1"));
  assert.ok(retrieved.includes("rgc-59-1"));
});

test("a decided verdict never reports missing facts", () => {
  assert.deepEqual(decideObligation(scene({ signs: [sign("s1", "stop")] })).missing, []);
});
