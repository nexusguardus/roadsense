import { decideObligation } from "./engine";
import { factById } from "./facts";
import { MODELS } from "./meta-client";
import { perceiveScene } from "./perceive";
import { analyzeScene, RoadsenseTimeoutError } from "./pipeline";
import type { PipelineDeps } from "./pipeline";
import type { AnalysisResult, Box, JunctionType, RoadsenseLocale, SceneFact, SceneFacts, WhatIfEdit } from "./types";

// What-if edits change one thing in a scene with Muse Image, read the edited photo
// again and analyse it only when the change took and nothing else the engine reads
// moved: in the Task 1 spike, the STOP edit also removed the car from the right.

// Which edits a scene offers lives in edits.ts, which the page can import without the model client.
export { editKey, matchesEdit, offerableEdits, proposeEdits, whyNotOffered } from "./edits";

/** Where a box sits across the photo, in words the image model can act on. */
function whereIn(box: Box): string {
  const centre = (box.x1 + box.x2) / 2;
  if (centre < 333) return "on the left of the photo";
  return centre > 667 ? "on the right of the photo" : "in the middle of the photo";
}

const SIGN_NAMES: Record<"yield" | "stop", string> = { yield: "yield", stop: "STOP" };
const SIGN_LOOKS: Record<"yield" | "stop", string> = {
  yield: "a Spanish yield sign (ceda el paso: a white inverted triangle with a red border)",
  stop: "a Spanish STOP sign (a red octagon with the word STOP in white)",
};
const KEEP =
  "Keep everything else exactly as it is: the same camera position, road layout, road markings, signs, vehicles, people, lighting and weather. Do not add or remove anything else.";

export function editPrompt(edit: WhatIfEdit, facts: SceneFacts): string {
  const fact = "factId" in edit ? factById(facts, edit.factId) : undefined;
  const where = fact ? ` ${whereIn(fact.box)}` : "";
  switch (edit.kind) {
    case "swap_sign": {
      const from = edit.to === "stop" ? "yield" : "stop";
      return `Replace the ${SIGN_NAMES[from]} sign facing the driver${where} with ${SIGN_LOOKS[edit.to]}, at the same size and position on the same post. ${KEEP}`;
    }
    case "remove_sign": {
      const kind = fact && "kind" in fact && (fact.kind === "yield" || fact.kind === "stop") ? SIGN_NAMES[fact.kind] : "traffic";
      return `Remove the ${kind} sign facing the driver${where}, together with its post, and fill the space with what is behind it. ${KEEP}`;
    }
    case "set_light": {
      // Spanish heads run red, amber, green from the top; Muse Image otherwise recolours the lit lamp in place.
      const lamp = edit.to === "red" ? "red in its top lamp, with the middle and bottom lamps dark" : "green in its bottom lamp, with the top and middle lamps dark";
      return `Make the traffic light facing the driver${where} show a steady ${lamp}. ${KEEP}`;
    }
    case "add_emergency_vehicle":
      return `Add a white Spanish ambulance with AMBULANCIA lettering and its blue emergency lights flashing, coming towards the junction along the road on the right. ${KEEP}`;
    case "add_pedestrian_on_crossing":
      return `Add a pedestrian walking across the zebra crossing directly in front of the driver. ${KEEP}`;
  }
}

/**
 * How a fact is matched across two readings of the photo, whose ids differ: by what it is and
 * whom it governs. Only what the engine reads has a key; non-ego signs, lights and markings
 * other than crossings don't affect the answer, so their coming and going is ignored.
 */
function factKey(fact: SceneFact): string | null {
  if ("position" in fact) return `road user ${fact.kind} ${fact.position}${fact.emergencyLightsOn ? " lights on" : ""}`;
  if ("state" in fact) return fact.appliesTo === "ego" ? `light ${fact.state}` : null;
  if (fact.kind === "zebra_crossing" || fact.kind === "pedestrian_crossing") return `crossing ${fact.kind}`;
  return fact.appliesTo === "ego" ? `ego ${fact.kind}` : null;
}

const allFacts = (facts: SceneFacts): SceneFact[] => [...facts.signs, ...facts.lights, ...facts.markings, ...facts.roadUsers];

function tally(facts: SceneFacts, skip: (key: string) => boolean): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of allFacts(facts).map(factKey)) {
    if (key !== null && !skip(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const hasEgoSign = (facts: SceneFacts, kind: string): boolean => facts.signs.some((s) => s.appliesTo === "ego" && s.kind === kind);

/** Whether `after` shows the change, and which keys the change is allowed to alter. */
function intended(before: SceneFacts, after: SceneFacts, edit: WhatIfEdit): { visible: boolean; alters: (key: string) => boolean } {
  switch (edit.kind) {
    case "swap_sign":
    case "remove_sign": {
      const from = before.signs.find((s) => s.id === edit.factId)?.kind;
      if (from === undefined) return { visible: false, alters: () => false };
      const visible = edit.kind === "remove_sign" ? !hasEgoSign(after, from) : from !== edit.to && hasEgoSign(after, edit.to) && !hasEgoSign(after, from);
      return { visible, alters: (key) => key === `ego ${from}` };
    }
    case "set_light": {
      const lights = after.lights.filter((l) => l.appliesTo === "ego");
      return { visible: lights.length > 0 && lights.every((l) => l.state === edit.to), alters: (key) => key.startsWith("light ") };
    }
    case "add_emergency_vehicle":
      return { visible: after.roadUsers.some((u) => u.kind === "emergency_vehicle" && u.emergencyLightsOn), alters: () => false };
    case "add_pedestrian_on_crossing":
      return { visible: after.roadUsers.some((u) => u.kind === "pedestrian" && u.position === "on_crossing_ahead"), alters: () => false };
  }
}

const junctionClass = (junction: JunctionType): string => (junction === "t_junction" ? "crossroads" : junction);

/**
 * True when `after` shows the intended change and everything else the engine reads in `before`
 * is still there: same kind, same approach, position or state. This covers every road user,
 * not only the facts that decided `before` (the spike's lost car was not one of those).
 */
export function verifyEdit(before: SceneFacts, after: SceneFacts, edit: WhatIfEdit): boolean {
  if (after.inScope !== before.inScope || junctionClass(after.junction) !== junctionClass(before.junction)) return false;
  const { visible, alters } = intended(before, after, edit);
  if (!visible) return false;
  const kept = tally(after, () => false);
  if (![...tally(before, alters)].every(([key, count]) => (kept.get(key) ?? 0) >= count)) return false;
  // The answer must follow from the edit alone: whatever else the photo now reads differently
  // (a crossing road's sign, the surface, an added car) must not change the engine's verdict.
  const expected = decideObligation(simulateEdit(before, edit));
  const actual = decideObligation(after);
  return expected.status === actual.status && expected.obligation === actual.obligation;
}

const NO_BOX: Box = { x1: 0, y1: 0, x2: 0, y2: 0 };

/** The facts as the edit alone would leave them. */
function simulateEdit(facts: SceneFacts, edit: WhatIfEdit): SceneFacts {
  switch (edit.kind) {
    case "swap_sign":
      return { ...facts, signs: facts.signs.map((s) => (s.id === edit.factId ? { ...s, kind: edit.to } : s)) };
    case "remove_sign":
      return { ...facts, signs: facts.signs.filter((s) => s.id !== edit.factId) };
    case "set_light":
      return { ...facts, lights: facts.lights.map((l) => (l.id === edit.factId ? { ...l, state: edit.to } : l)) };
    case "add_emergency_vehicle":
      return {
        ...facts,
        roadUsers: [...facts.roadUsers, { id: "edit", kind: "emergency_vehicle", position: "oncoming", emergencyLightsOn: true, box: NO_BOX, confidence: 1 }],
      };
    case "add_pedestrian_on_crossing":
      return {
        ...facts,
        roadUsers: [...facts.roadUsers, { id: "edit", kind: "pedestrian", position: "on_crossing_ahead", emergencyLightsOn: false, box: NO_BOX, confidence: 1 }],
      };
  }
}

/**
 * Edits the photo, reads it again and, when verifyEdit passes, analyses it. deps.budgetMs covers
 * the whole what-if (edit, perception and analysis), so its route needs a longer budget than an analysis.
 */
export async function runWhatIf(
  deps: PipelineDeps,
  input: { imageDataUrl: string; facts: SceneFacts; edit: WhatIfEdit; locale: RoadsenseLocale },
): Promise<{ applied: boolean; imageDataUrl: string | null; result: AnalysisResult | null; costUsd: number }> {
  const now = deps.now ?? Date.now;
  const start = now();
  const edited = await deps.client.editImage({ imageDataUrl: input.imageDataUrl, prompt: editPrompt(input.edit, input.facts) });
  if (now() - start > deps.budgetMs) throw new RoadsenseTimeoutError("perceive", deps.budgetMs);
  const perceived = await perceiveScene(deps.client, edited.imageDataUrl);
  const spent = edited.costUsd + perceived.costUsd;
  if (!verifyEdit(input.facts, perceived.facts, input.edit)) return { applied: false, imageDataUrl: null, result: null, costUsd: spent };

  const analysis = await analyzeScene(
    { ...deps, now, budgetMs: deps.budgetMs - (now() - start) },
    { imageDataUrl: edited.imageDataUrl, locale: input.locale, facts: perceived.facts },
  );
  const result: AnalysisResult = {
    ...analysis,
    costUsd: spent + analysis.costUsd,
    latencyMs: now() - start,
    modelIds: [...new Set([MODELS.image, deps.client.sparkModel, ...analysis.modelIds])],
  };
  return { applied: true, imageDataUrl: edited.imageDataUrl, result, costUsd: result.costUsd };
}
