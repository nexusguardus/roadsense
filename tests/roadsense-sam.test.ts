// SAM 3.1 gives a second, independent look at the facts a decision depends on:
// a fact is confirmed only when SAM finds the same kind of object where Muse
// Spark said it was. Parsing uses the real SAM output recorded in Task 1.
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

const { parseSamOutput, toGridBox, iou, overlapOverSmaller, samConceptFor } = await import("../lib/roadsense/sam.ts");
const { confirmEvidence, confirmEvidenceDual } = await import("../lib/roadsense/evidence.ts");

const LINE =
  "<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|><|mask;x=0;y=0;data=2,2,~abc|>, 1<|box;x1=10;y1=10;x2=20;y2=20;w=320;h=334;c=0.96|><|mask;x=0;y=0;c=0.9;data=2,2,!xy|>";
const RECORDED = readFileSync(new URL("tests/fixtures/roadsense/sam-traffic-sign.txt", ROOT), "utf8");
const IMAGE = "data:image/webp;base64,AAAA";

const BOX = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });
/** The yield sign of the spike scene as Muse Spark located it (Task 1). */
const SPARK_SIGN_BOX = BOX(670, 284, 737, 394);
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
const sign = (id: string, box = SPARK_SIGN_BOX) => ({ id, kind: "yield", appliesTo: "ego", box, confidence: 0.9 });

/** A MetaClient stand-in: segment answers per concept, chatJson replays one reply. */
function fakeClient(samByConcept: Record<string, string>, chatReply: unknown = null) {
  const concepts: string[] = [];
  const chats: { user: string }[] = [];
  const client = {
    async segment({ concept }: { concept: string }) {
      concepts.push(concept);
      return { text: samByConcept[concept] ?? "", costUsd: 0.0025 };
    },
    async chatJson(args: { user: string }) {
      chats.push(args);
      return { json: chatReply, costUsd: 0.001 };
    },
    async editImage() {
      throw new Error("unused");
    },
    async generateImage() {
      throw new Error("unused");
    },
  };
  return { client, concepts, chats };
}

test("parses boxes with and without confidence", () => {
  const detections = parseSamOutput(LINE);
  assert.equal(detections.length, 2);
  assert.deepEqual(detections[0].box, { x1: 211, y1: 228, x2: 270, y2: 254 });
  assert.equal(detections[0].confidence, null);
  assert.equal(detections[1].objectId, 1);
  assert.equal(detections[1].confidence, 0.96);
});

test("parses the recorded SAM output", () => {
  const [first] = parseSamOutput(RECORDED);
  assert.deepEqual(first.box, { x1: 1234, y1: 337, x2: 1383, y2: 477 });
  assert.equal(first.width, 1920);
  assert.equal(first.height, 1280);
  assert.ok(first.confidence !== null && first.confidence > 0.9);
});

test("empty output means no detections", () => {
  assert.deepEqual(parseSamOutput(""), []);
});

test("grid conversion", () => {
  const [d] = parseSamOutput("<0f>0<|box;x1=160;y1=0;x2=320;y2=334;w=320;h=334|><|mask;x=0;y=0;data=1,1,~a|>");
  assert.deepEqual(toGridBox(d), { x1: 500, y1: 0, x2: 1000, y2: 1000 });
});

test("iou and overlap over the smaller box", () => {
  assert.equal(iou(BOX(0, 0, 10, 10), BOX(0, 0, 10, 10)), 1);
  assert.equal(iou(BOX(0, 0, 10, 10), BOX(20, 20, 30, 30)), 0);
  assert.equal(overlapOverSmaller(BOX(0, 0, 100, 100), BOX(10, 10, 20, 20)), 1);
});

test("the recorded sign matches Muse Spark's box by overlap, not by IoU", () => {
  const samBox = toGridBox(parseSamOutput(RECORDED)[0]);
  assert.ok(iou(SPARK_SIGN_BOX, samBox) < 0.5);
  assert.ok(overlapOverSmaller(SPARK_SIGN_BOX, samBox) >= 0.5);
});

test("confirms a fact when a detection overlaps enough", async () => {
  const { client } = fakeClient({ "traffic sign": RECORDED });
  const { evidence, costUsd } = await confirmEvidence(client, IMAGE, scene({ signs: [sign("s1")] }), ["s1"]);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].factId, "s1");
  assert.equal(evidence[0].concept, "traffic sign");
  assert.equal(evidence[0].confirmed, true);
  assert.ok(evidence[0].matchedBox !== null);
  assert.ok(evidence[0].overlap >= 0.5);
  assert.equal(costUsd, 0.0025);
});

test("does not confirm when the best overlap is below 0.4", async () => {
  const { client } = fakeClient({ "traffic sign": RECORDED });
  const { evidence } = await confirmEvidence(client, IMAGE, scene({ signs: [sign("s1", BOX(0, 0, 100, 100))] }), ["s1"]);
  assert.equal(evidence[0].confirmed, false);
  assert.equal(evidence[0].matchedBox, null);
});

test("a small fact box inside a much larger detection is not confirmed", async () => {
  const wholeImage = "<0f>0<|box;x1=0;y1=0;x2=1920;y2=1280;w=1920;h=1280;c=0.9|><|mask;x=0;y=0;data=1,1,~a|>";
  const { client } = fakeClient({ "traffic sign": wholeImage });
  const { evidence } = await confirmEvidence(client, IMAGE, scene({ signs: [sign("s1")] }), ["s1"]);
  assert.equal(evidence[0].confirmed, false);
});

test("asks SAM at most five concepts", async () => {
  const facts = scene({
    signs: [sign("s1")],
    lights: [{ id: "l1", state: "red", appliesTo: "ego", box: BOX(1, 1, 2, 2), confidence: 0.9 }],
    markings: [
      { id: "m1", kind: "zebra_crossing", appliesTo: "ego", box: BOX(1, 1, 2, 2), confidence: 0.9 },
      { id: "m2", kind: "stop_line", appliesTo: "ego", box: BOX(1, 1, 2, 2), confidence: 0.9 },
      { id: "m3", kind: "stop_word", appliesTo: "ego", box: BOX(1, 1, 2, 2), confidence: 0.9 },
    ],
    roadUsers: [
      { id: "u1", kind: "car", position: "from_right", emergencyLightsOn: false, box: BOX(1, 1, 2, 2), confidence: 0.9 },
      { id: "u2", kind: "motorcycle", position: "from_left", emergencyLightsOn: false, box: BOX(1, 1, 2, 2), confidence: 0.9 },
    ],
  });
  const { client, concepts } = fakeClient({});
  const { evidence } = await confirmEvidence(client, IMAGE, facts, ["s1", "l1", "m1", "m2", "m3", "u1", "u2"]);
  assert.equal(concepts.length, 5);
  assert.equal(evidence.length, 7);
  assert.equal(evidence.find((e) => e.factId === "u2")?.confirmed, false);
});

test("facts of the same concept share one SAM call", async () => {
  const { client, concepts } = fakeClient({ "traffic sign": RECORDED });
  await confirmEvidence(client, IMAGE, scene({ signs: [sign("s1"), sign("s2", BOX(10, 10, 50, 50))] }), ["s1", "s2"]);
  assert.deepEqual(concepts, ["traffic sign"]);
});

test("concepts follow the fact kind", () => {
  assert.equal(samConceptFor(sign("s1")), "traffic sign");
  assert.equal(samConceptFor({ id: "p1", kind: "pedestrian", position: "on_crossing_ahead", emergencyLightsOn: false, box: BOX(1, 1, 2, 2), confidence: 1 }), "person");
  assert.equal(samConceptFor({ id: "m1", kind: "zebra_crossing", appliesTo: "ego", box: BOX(1, 1, 2, 2), confidence: 1 }), "zebra crossing");
  assert.equal(samConceptFor({ id: "l1", state: "green", appliesTo: "ego", box: BOX(1, 1, 2, 2), confidence: 1 }), "traffic light");
  // SAM finds nothing for "emergency vehicle" on a lit ambulance; "ambulance" finds it (Task 13 probe).
  assert.equal(samConceptFor({ id: "e1", kind: "emergency_vehicle", position: "oncoming", emergencyLightsOn: true, box: BOX(1, 1, 2, 2), confidence: 1 }), "ambulance");
  // SAM finds nothing for "tram"; "streetcar" finds it (Task 14 probe).
  assert.equal(samConceptFor({ id: "t1", kind: "tram", position: "from_left", emergencyLightsOn: false, box: BOX(1, 1, 2, 2), confidence: 1 }), "streetcar");
});

test("confirms a near miss of 0.45 overlap: Muse Spark's boxes run offset", async () => {
  const sam = "<0f>0<|box;x1=55;y1=0;x2=155;y2=100;w=1000;h=1000;c=0.9|><|mask;x=0;y=0;data=1,1,~a|>";
  const { client } = fakeClient({ "traffic sign": sam });
  const { evidence } = await confirmEvidence(client, IMAGE, scene({ signs: [sign("s1", BOX(0, 0, 100, 100))] }), ["s1"]);
  assert.equal(evidence[0].confirmed, true);
  assert.ok(Math.abs(evidence[0].overlap - 0.45) < 1e-9);
});

test("dual mode confirms only facts the second pass finds", async () => {
  const facts = scene({
    signs: [sign("s1")],
    roadUsers: [{ id: "u1", kind: "car", position: "from_right", emergencyLightsOn: false, box: BOX(600, 400, 800, 550), confidence: 0.9 }],
  });
  const reply = { checks: [{ factId: "s1", present: true, box: BOX(660, 280, 740, 390) }, { factId: "u1", present: false, box: null }] };
  const { client, concepts, chats } = fakeClient({}, reply);
  const { evidence, costUsd } = await confirmEvidenceDual(client, IMAGE, facts, ["s1", "u1"]);
  assert.deepEqual(evidence.map((e) => [e.factId, e.confirmed]), [["s1", true], ["u1", false]]);
  assert.equal(concepts.length, 0);
  assert.equal(costUsd, 0.001);
  // The second look names each fact but not where the first one put it, so its box is an independent check.
  assert.match(chats[0].user, /s1/);
  assert.match(chats[0].user, /u1/);
  assert.doesNotMatch(chats[0].user, /670/);
});

test("dual mode rejects a reply without a checks list", async () => {
  const { client } = fakeClient({}, { nope: true });
  await assert.rejects(confirmEvidenceDual(client, IMAGE, scene({ signs: [sign("s1")] }), ["s1"]), { name: "RoadsenseValidationError" });
});
