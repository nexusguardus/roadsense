// Scene facts are what perception hands the rule engine. These checks keep
// model output inside the closed vocabulary and the 0-1000 box grid, and keep
// the JSON schemas valid for the API's strict structured-output mode.
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

const { parseSceneFacts } = await import("../lib/roadsense/facts.ts");
const { PERCEPTION_SCHEMA, decisionSchema } = await import("../lib/roadsense/schemas.ts");
const { scenesFrom } = await import("../lib/roadsense/scenes.ts");
const { RoadsenseValidationError } = await import("../lib/roadsense/errors.ts");

const SAMPLE = {
  inScope: true,
  outOfScopeReason: null,
  junction: "crossroads",
  egoRoadPaved: true,
  crossRoadPaved: true,
  signs: [{ id: "s1", kind: "yield", appliesTo: "ego", box: { x1: 600, y1: 200, x2: 660, y2: 280 }, confidence: 0.9 }],
  lights: [],
  markings: [{ id: "m1", kind: "yield_triangle", appliesTo: "ego", box: { x1: 400, y1: 800, x2: 520, y2: 900 }, confidence: 0.8 }],
  roadUsers: [{ id: "u1", kind: "car", position: "from_right", emergencyLightsOn: false, box: { x1: 700, y1: 400, x2: 900, y2: 560 }, confidence: 0.95 }],
  unknowns: [],
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const withBox = (box: Record<string, number>) => {
  const facts = clone(SAMPLE);
  facts.signs[0].box = box;
  return facts;
};
const withSignKind = (kind: string) => {
  const facts = clone(SAMPLE);
  facts.signs[0].kind = kind;
  return facts;
};
const withDuplicateIds = () => {
  const facts = clone(SAMPLE);
  facts.roadUsers[0].id = "s1";
  return facts;
};

/** Calls `visit` on every object-typed node of a JSON schema. */
function walkObjects(node: unknown, visit: (o: Record<string, any>) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walkObjects(item, visit);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const schema = node as Record<string, any>;
  if (schema.type === "object") visit(schema);
  for (const value of Object.values(schema)) walkObjects(value, visit);
}

const result = (certainty: string) => ({ certainty });
const SCENE = {
  id: "signs-1",
  family: "signs",
  title: { es: "Ceda el paso", en: "Give way", fr: "Cédez le passage", ar: "إفساح الطريق" },
  imagePath: "/roadsense/scenes/signs-1.webp",
  facts: SAMPLE,
  expected: { kind: "answerable", obligation: "yield", ruleIds: ["rgc-56-5"] },
  shown: true,
  precomputed: { es: result("checked"), en: result("checked"), fr: result("checked"), ar: result("checked") },
  whatIfs: [],
};

test("valid facts round-trip", () => {
  assert.deepEqual(parseSceneFacts(SAMPLE), SAMPLE);
});

test("box values are clamped to the 0-1000 grid", () => {
  assert.equal(parseSceneFacts(withBox({ x1: 10, y1: 10, x2: 1003, y2: 40 })).signs[0].box.x2, 1000);
});

test("confidence is clamped to 0-1", () => {
  const facts = clone(SAMPLE);
  facts.signs[0].confidence = 1.4;
  assert.equal(parseSceneFacts(facts).signs[0].confidence, 1);
});

test("unknown sign kind is rejected", () => {
  assert.throws(() => parseSceneFacts(withSignKind("give_way")), RoadsenseValidationError);
});

test("a missing field is rejected", () => {
  const { unknowns: _dropped, ...facts } = clone(SAMPLE);
  assert.throws(() => parseSceneFacts(facts), RoadsenseValidationError);
});

test("duplicate fact ids are rejected", () => {
  assert.throws(() => parseSceneFacts(withDuplicateIds()), RoadsenseValidationError);
});

test("perception schema is strict-mode compatible", () => {
  let objects = 0;
  walkObjects(PERCEPTION_SCHEMA, (o) => {
    objects += 1;
    assert.equal(o.additionalProperties, false);
    assert.deepEqual([...o.required].sort(), Object.keys(o.properties).sort());
  });
  assert.ok(objects >= 6, "root, box and four fact kinds");
  assert.equal((PERCEPTION_SCHEMA as Record<string, unknown>).type, "object");
});

test("decision schema limits ruleIds to the given ids", () => {
  const schema = decisionSchema(["rgc-57-1"]) as Record<string, any>;
  assert.deepEqual(schema.properties.ruleIds.items.enum, ["rgc-57-1"]);
});

test("an empty scene index is valid", () => {
  assert.deepEqual(scenesFrom([]), []);
});

test("a scene with invalid facts is rejected", () => {
  assert.throws(() => scenesFrom([{ ...SCENE, facts: withSignKind("give_way") }]), RoadsenseValidationError);
});

test("a valid scene is accepted", () => {
  assert.equal(scenesFrom([SCENE])[0].id, "signs-1");
});
