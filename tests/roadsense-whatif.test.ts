// What-if edits change one thing in a scene, read the edited photo again and
// analyse it only when the change took and nothing else that matters moved.
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

const { proposeEdits, editKey, editPrompt, verifyEdit, runWhatIf } = await import("../lib/roadsense/whatif.ts");
const { RoadsenseTimeoutError } = await import("../lib/roadsense/pipeline.ts");
const { corpusFrom } = await import("../lib/roadsense/corpus.ts");

const corpus = corpusFrom(JSON.parse(readFileSync(new URL("data/roadsense/corpus.json", ROOT), "utf8")));
const SAM_SIGN = readFileSync(new URL("tests/fixtures/roadsense/sam-traffic-sign.txt", ROOT), "utf8");
const IMAGE = "data:image/webp;base64,AAAA";
const EDITED = "data:image/webp;base64,EDITED";

const BOX = { x1: 100, y1: 100, x2: 200, y2: 200 };
const SIGN_BOX = { x1: 670, y1: 284, x2: 737, y2: 394 };
/** The Task 1 spike scene: a yield sign for the learner and a car coming from the right. */
const FACTS = {
  inScope: true,
  outOfScopeReason: null,
  junction: "crossroads",
  egoRoadPaved: true,
  crossRoadPaved: true,
  signs: [{ id: "s1", kind: "yield", appliesTo: "ego", box: SIGN_BOX, confidence: 0.9 }],
  lights: [],
  markings: [],
  roadUsers: [
    { id: "u1", kind: "car", position: "from_right", emergencyLightsOn: false, box: { x1: 820, y1: 420, x2: 990, y2: 560 }, confidence: 0.85 },
  ],
  unknowns: [],
};
const SWAP = { kind: "swap_sign", factId: "s1", to: "stop" };
/** The edited photo read again: the sign is now a STOP and the car is still there (ids differ between readings). */
const SWAPPED = {
  ...FACTS,
  signs: [{ id: "s4", kind: "stop", appliesTo: "ego", box: SIGN_BOX, confidence: 0.9 }],
  roadUsers: [{ ...FACTS.roadUsers[0], id: "u7" }],
};
const DECISION = {
  obligation: "stop_and_yield",
  priorityTo: ["u7"],
  rationale: "The STOP sign means a full stop at the line (detención obligatoria), then letting the car go first.",
  temptingWrongAnswer: "Slow down and go if the road looks clear.",
  whyWrong: "A STOP sign always requires a full stop, even with nobody coming.",
  ruleIds: ["rgc-56-5"],
};

/** A MetaClient stand-in: the edit returns EDITED, perception reads it as `perception`, every call is recorded. */
function fakeClient(perception: unknown) {
  const calls = { edits: [] as string[], chat: [] as string[], segment: 0 };
  const replies: Record<string, [unknown, number]> = { scene_facts: [perception, 0.01], decision: [DECISION, 0.02] };
  const client = {
    sparkModel: "muse-spark-1.3",
    async editImage({ prompt }: { prompt: string }) {
      calls.edits.push(prompt);
      return { imageDataUrl: EDITED, costUsd: 0.01 };
    },
    async chatJson({ schemaName }: { schemaName: string }) {
      calls.chat.push(schemaName);
      const [json, costUsd] = replies[schemaName];
      return { json, costUsd };
    },
    async segment({ concept }: { concept: string }) {
      calls.segment++;
      return { text: concept === "traffic sign" ? SAM_SIGN : "", costUsd: 0.0025 };
    },
    async generateImage() {
      throw new Error("unused");
    },
  };
  return { client, calls };
}

const deps = (client: unknown, extra: Record<string, unknown> = {}) => ({ client, corpus, evidenceMode: "sam", budgetMs: 45_000, ...extra });
const INPUT = { imageDataUrl: IMAGE, facts: FACTS, edit: SWAP, locale: "en" };

test("proposes swap and remove for a scene with a yield sign", () => {
  const edits = proposeEdits(FACTS);
  assert.deepEqual(edits[0], { kind: "swap_sign", factId: "s1", to: "stop" });
  assert.deepEqual(edits[1], { kind: "remove_sign", factId: "s1" });
  assert.deepEqual(edits.map(editKey), ["swap_sign:s1:stop", "remove_sign:s1", "add_emergency_vehicle", "add_pedestrian_ahead"]);
});

test("never proposes more than four edits", () => {
  const busy = {
    ...FACTS,
    lights: [{ id: "l1", state: "green", appliesTo: "ego", box: BOX, confidence: 0.9 }],
    markings: [{ id: "m1", kind: "zebra_crossing", appliesTo: "ego", box: BOX, confidence: 0.9 }],
  };
  assert.deepEqual(proposeEdits(busy).map(editKey), ["swap_sign:s1:stop", "remove_sign:s1", "set_light:l1:red", "add_emergency_vehicle"]);
});

test("verifyEdit accepts a clean swap", () => {
  assert.equal(verifyEdit(FACTS, SWAPPED, SWAP), true);
});

test("verifyEdit rejects when the sign did not change", () => {
  assert.equal(verifyEdit(FACTS, FACTS, SWAP), false);
});

test("verifyEdit rejects when another critical fact changed", () => {
  // The Task 1 spike's STOP edit also removed the car coming from the right.
  assert.equal(verifyEdit(FACTS, { ...SWAPPED, roadUsers: [] }, SWAP), false);
});

test("verifyEdit rejects an edit whose answer comes from something else that changed", () => {
  // The learner's yield goes, and so does the right-hand road's STOP: the answer flips because of
  // the lost STOP, not because of the edit (final review, probe M).
  const withRightStop = { ...FACTS, signs: [...FACTS.signs, { id: "s2", kind: "stop", appliesTo: "right", box: BOX, confidence: 0.9 }] };
  const removed = { ...FACTS, signs: [], roadUsers: [{ ...FACTS.roadUsers[0], id: "u7" }] };
  assert.equal(verifyEdit(withRightStop, removed, { kind: "remove_sign", factId: "s1" }), false);
  // With the right-hand STOP still there, the same edit is clean.
  const kept = { ...removed, signs: [{ id: "s9", kind: "stop", appliesTo: "right", box: BOX, confidence: 0.9 }] };
  assert.equal(verifyEdit(withRightStop, kept, { kind: "remove_sign", factId: "s1" }), true);
});

test("verifyEdit rejects an edit that changed the kind of scene", () => {
  assert.equal(verifyEdit(FACTS, { ...SWAPPED, junction: "none" }, SWAP), false);
});

test("verifyEdit checks each kind of change", () => {
  const remove = { kind: "remove_sign", factId: "s1" };
  assert.equal(verifyEdit(FACTS, { ...FACTS, signs: [] }, remove), true);
  assert.equal(verifyEdit(FACTS, FACTS, remove), false);

  const green = { ...FACTS, lights: [{ id: "l1", state: "green", appliesTo: "ego", box: BOX, confidence: 0.9 }] };
  const toRed = { kind: "set_light", factId: "l1", to: "red" };
  assert.equal(verifyEdit(green, { ...green, lights: [{ ...green.lights[0], id: "l2", state: "red" }] }, toRed), true);
  assert.equal(verifyEdit(green, green, toRed), false);

  const ambulance = { id: "u9", kind: "emergency_vehicle", position: "from_left", emergencyLightsOn: true, box: BOX, confidence: 0.9 };
  const addAmbulance = { kind: "add_emergency_vehicle" };
  assert.equal(verifyEdit(FACTS, { ...FACTS, roadUsers: [...FACTS.roadUsers, ambulance] }, addAmbulance), true);
  assert.equal(verifyEdit(FACTS, { ...FACTS, roadUsers: [ambulance] }, addAmbulance), false);

  const pedestrian = { id: "u5", kind: "pedestrian", position: "on_crossing_ahead", emergencyLightsOn: false, box: BOX, confidence: 0.9 };
  const addPedestrian = { kind: "add_pedestrian_on_crossing" };
  assert.equal(verifyEdit(FACTS, { ...FACTS, roadUsers: [...FACTS.roadUsers, pedestrian] }, addPedestrian), true);
  assert.equal(verifyEdit(FACTS, FACTS, addPedestrian), false);

  const stepping = { id: "u6", kind: "pedestrian", position: "in_path_ahead", emergencyLightsOn: false, box: BOX, confidence: 0.9 };
  const addStepping = { kind: "add_pedestrian_ahead" };
  assert.equal(verifyEdit(FACTS, { ...FACTS, roadUsers: [...FACTS.roadUsers, stepping] }, addStepping), true);
  assert.equal(verifyEdit(FACTS, { ...FACTS, roadUsers: [...FACTS.roadUsers, pedestrian] }, addStepping), false, "a person on a crossing is the other edit");
  assert.equal(verifyEdit(FACTS, FACTS, addStepping), false);
});

test("verifyEdit rejects an edit that changed the road surface", () => {
  // Found on surface-1: the person was added, but the gravel track came back as tarmac.
  const dirt = { ...FACTS, egoRoadPaved: false };
  const stepping = { id: "u6", kind: "pedestrian", position: "in_path_ahead", emergencyLightsOn: false, box: BOX, confidence: 0.9 };
  const addStepping = { kind: "add_pedestrian_ahead" };
  assert.equal(verifyEdit(dirt, { ...dirt, roadUsers: [...dirt.roadUsers, stepping] }, addStepping), true);
  assert.equal(verifyEdit(dirt, { ...dirt, egoRoadPaved: true, roadUsers: [...dirt.roadUsers, stepping] }, addStepping), false);
  // A surface one reading couldn't tell is no change.
  assert.equal(verifyEdit(dirt, { ...dirt, egoRoadPaved: null, roadUsers: [...dirt.roadUsers, stepping] }, addStepping), true);
});

test("editPrompt puts the stepping-out person in the road, off any crossing", () => {
  const prompt = editPrompt({ kind: "add_pedestrian_ahead" }, FACTS);
  assert.match(prompt, /steps? into the road/i);
  assert.match(prompt, /not on a (zebra|pedestrian) crossing/i);
});

test("editKey is stable", () => {
  assert.equal(editKey({ kind: "swap_sign", factId: "s1", to: "stop" }), "swap_sign:s1:stop");
});

test("editPrompt names the new sign and where the old one is", () => {
  const prompt = editPrompt(SWAP, FACTS);
  assert.match(prompt, /STOP/);
  assert.match(prompt, /right of the photo/);
  assert.match(prompt, /Keep everything else/);
});

test("editPrompt puts each light colour in its own lamp and makes the ambulance Spanish", () => {
  // Muse Image once lit red in the bottom (green) lamp; Spanish heads have red on top.
  const green = { ...FACTS, lights: [{ id: "l1", state: "green", appliesTo: "ego", box: BOX, confidence: 0.9 }] };
  assert.match(editPrompt({ kind: "set_light", factId: "l1", to: "red" }, green), /red in its top lamp/);
  assert.match(editPrompt({ kind: "set_light", factId: "l1", to: "green" }, green), /green in its bottom lamp/);
  assert.match(editPrompt({ kind: "add_emergency_vehicle" }, FACTS), /AMBULANCIA/);
});

test("runWhatIf reports not applied without analysing", async () => {
  const { client, calls } = fakeClient(FACTS); // the edited photo still shows the yield sign
  const outcome = await runWhatIf(deps(client), INPUT);
  assert.deepEqual(outcome, { applied: false, imageDataUrl: null, result: null, costUsd: 0.02 });
  assert.deepEqual(calls.chat, ["scene_facts"]);
  assert.equal(calls.segment, 0);
});

test("runWhatIf analyses the edited scene once the edit is verified", async () => {
  const { client, calls } = fakeClient(SWAPPED);
  const outcome = await runWhatIf(deps(client), INPUT);
  assert.equal(outcome.applied, true);
  assert.equal(outcome.imageDataUrl, EDITED);
  assert.equal(outcome.result?.engine.obligation, "stop_and_yield");
  assert.equal(outcome.result?.certainty, "checked");
  assert.deepEqual(calls.chat, ["scene_facts", "decision"]);
  assert.ok(Math.abs(outcome.costUsd - (0.01 + 0.01 + 0.0025 + 0.02)) < 1e-9);
  assert.equal(outcome.result?.costUsd, outcome.costUsd);
  assert.deepEqual(outcome.result?.modelIds, ["muse-image-1.0", "muse-spark-1.3", "sam-3.1"]);
});

test("runWhatIf stops when the edit used up the budget", async () => {
  const { client, calls } = fakeClient(SWAPPED);
  const now = () => (calls.edits.length > 0 ? 50_000 : 0);
  await assert.rejects(runWhatIf(deps(client, { now }), INPUT), RoadsenseTimeoutError);
  assert.equal(calls.chat.length, 0);
});

// Typed what-ifs (2026-10-27 redesign): every edit a photo allows, and why one it doesn't allow is refused.
const { offerableEdits, matchesEdit, whyNotOffered } = await import("../lib/roadsense/whatif.ts");
const { NOT_OFFERED_CAUSES } = await import("../lib/roadsense/edits.ts");

/** The spike scene with only what is asked for: the learner's sign and light, a zebra ahead, a pedestrian on it, an ambulance. */
function factsWith(opts: { sign?: string; light?: string; zebra?: boolean; pedestrian?: boolean; inPath?: boolean; ambulance?: boolean }) {
  return {
    ...FACTS,
    signs: opts.sign ? [{ id: "s1", kind: opts.sign, appliesTo: "ego", box: SIGN_BOX, confidence: 0.9 }] : [],
    lights: opts.light ? [{ id: "l1", state: opts.light, appliesTo: "ego", box: BOX, confidence: 0.9 }] : [],
    markings: opts.zebra ? [{ id: "m1", kind: "zebra_crossing", appliesTo: "ego", box: BOX, confidence: 0.9 }] : [],
    roadUsers: [
      ...(opts.pedestrian ? [{ id: "u1", kind: "pedestrian", position: "on_crossing_ahead", emergencyLightsOn: false, box: BOX, confidence: 0.9 }] : []),
      ...(opts.inPath ? [{ id: "u3", kind: "pedestrian", position: "in_path_ahead", emergencyLightsOn: false, box: BOX, confidence: 0.9 }] : []),
      ...(opts.ambulance ? [{ id: "u2", kind: "emergency_vehicle", position: "from_left", emergencyLightsOn: true, box: BOX, confidence: 0.9 }] : []),
    ],
  };
}

/** Every match a learner's words can become, apart from "none". */
const MATCHES = [
  { kind: "swap_sign" },
  { kind: "swap_sign", to: "stop" },
  { kind: "swap_sign", to: "yield" },
  { kind: "remove_sign" },
  { kind: "set_light" },
  { kind: "set_light", to: "red" },
  { kind: "set_light", to: "green" },
  { kind: "add_pedestrian_on_crossing" },
  { kind: "add_pedestrian_ahead" },
  { kind: "add_emergency_vehicle" },
];

test("offerableEdits lists every edit; proposeEdits keeps the first four", () => {
  const facts = factsWith({ sign: "stop", light: "green", zebra: true });
  assert.deepEqual(
    offerableEdits(facts).map((edit) => edit.kind),
    ["swap_sign", "remove_sign", "set_light", "add_emergency_vehicle", "add_pedestrian_on_crossing"],
  );
  assert.deepEqual(proposeEdits(facts), offerableEdits(facts).slice(0, 4));
});

test("a person steps out in front where there is no zebra crossing, onto the zebra where there is one", () => {
  assert.deepEqual(
    offerableEdits(factsWith({ sign: "yield" })).map((edit) => edit.kind),
    ["swap_sign", "remove_sign", "add_emergency_vehicle", "add_pedestrian_ahead"],
  );
  assert.ok(!offerableEdits(factsWith({ sign: "yield", zebra: true })).some((edit) => edit.kind === "add_pedestrian_ahead"));
  // Never a second person in the learner's path.
  const pedestrianEdits = (facts: ReturnType<typeof factsWith>) => offerableEdits(facts).filter((edit) => edit.kind.startsWith("add_pedestrian"));
  assert.deepEqual(pedestrianEdits(factsWith({ inPath: true })), []);
  assert.deepEqual(pedestrianEdits(factsWith({ zebra: true, pedestrian: true })), []);
});

test("a person in front matches whichever pedestrian edit the photo offers", () => {
  // Learners rarely say whether there is a crossing: the photo decides.
  assert.equal(matchesEdit({ kind: "add_pedestrian_on_crossing" }, { kind: "add_pedestrian_ahead" }), true);
  assert.equal(matchesEdit({ kind: "add_pedestrian_ahead" }, { kind: "add_pedestrian_on_crossing" }), true);
  assert.equal(matchesEdit({ kind: "add_pedestrian_ahead" }, { kind: "add_emergency_vehicle" }), false);
});

test("matchesEdit needs the same kind, and the same direction when the match names one", () => {
  const toRed = { kind: "set_light", factId: "l1", to: "red" };
  assert.equal(matchesEdit({ kind: "set_light" }, toRed), true);
  assert.equal(matchesEdit({ kind: "set_light", to: "red" }, toRed), true);
  assert.equal(matchesEdit({ kind: "set_light", to: "green" }, toRed), false);
  assert.equal(matchesEdit({ kind: "remove_sign" }, toRed), false);
  assert.equal(matchesEdit({ kind: "none" }, toRed), false);
});

test("whyNotOffered names the cause", () => {
  assert.equal(whyNotOffered({ kind: "set_light", to: "red" }, factsWith({ light: "amber" })), "cant_change");
  assert.equal(whyNotOffered({ kind: "set_light" }, factsWith({})), "no_light");
  assert.equal(whyNotOffered({ kind: "set_light", to: "green" }, factsWith({ light: "green" })), "light_already_green");
  assert.equal(whyNotOffered({ kind: "set_light", to: "red" }, factsWith({ light: "red" })), "light_already_red");
  assert.equal(whyNotOffered({ kind: "swap_sign", to: "stop" }, factsWith({ sign: "stop" })), "sign_already_stop");
  assert.equal(whyNotOffered({ kind: "swap_sign", to: "yield" }, factsWith({ sign: "yield" })), "sign_already_yield");
  assert.equal(whyNotOffered({ kind: "swap_sign" }, factsWith({})), "no_sign");
  assert.equal(whyNotOffered({ kind: "remove_sign" }, factsWith({ sign: "priority_road" })), "cant_change");
  assert.equal(whyNotOffered({ kind: "add_pedestrian_on_crossing" }, factsWith({ zebra: true, pedestrian: true })), "pedestrian_already");
  assert.equal(whyNotOffered({ kind: "add_pedestrian_on_crossing" }, factsWith({})), null, "no zebra: the person steps out in front instead");
  assert.equal(whyNotOffered({ kind: "add_pedestrian_ahead" }, factsWith({ inPath: true })), "pedestrian_already");
  assert.equal(whyNotOffered({ kind: "add_emergency_vehicle" }, factsWith({ ambulance: true })), "emergency_already");
  assert.equal(whyNotOffered({ kind: "set_light", to: "red" }, factsWith({ light: "green" })), null);
  assert.equal(whyNotOffered({ kind: "swap_sign" }, factsWith({ sign: "stop" })), null);
});

test("whyNotOffered is null exactly when an offerable edit matches, on every curated scene", () => {
  const index = JSON.parse(readFileSync(new URL("data/roadsense/scenes/index.json", ROOT), "utf8")) as { id: string; facts: typeof FACTS }[];
  const cases = [
    ...index.map((scene) => ({ name: scene.id, facts: scene.facts })),
    { name: "five edits", facts: factsWith({ sign: "stop", light: "green", zebra: true }) },
    { name: "amber and priority road", facts: factsWith({ sign: "priority_road", light: "amber" }) },
  ];
  for (const { name, facts } of cases) {
    for (const match of MATCHES) {
      const cause = whyNotOffered(match, facts);
      const offered = offerableEdits(facts).some((edit) => matchesEdit(match, edit));
      assert.equal(cause === null, offered, `${name} ${JSON.stringify(match)}: ${cause}`);
      if (cause !== null) assert.ok(NOT_OFFERED_CAUSES.includes(cause), `${name}: ${cause} is a known cause`);
    }
  }
});
