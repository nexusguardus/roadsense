import type { LightFact, SceneFacts, SignFact, WhatIfEdit, WhatIfMatch } from "./types";

// Which what-if edits a scene offers. Kept apart from whatif.ts, which runs the
// edits, so the /roadsense page can offer live chips without the model client.

const MAX_EDITS = 4;

/** The sign an edit acts on: the learner's STOP sign, else their yield sign. */
const egoSign = (facts: SceneFacts): SignFact | undefined =>
  facts.signs.find((s) => s.appliesTo === "ego" && s.kind === "stop") ?? facts.signs.find((s) => s.appliesTo === "ego" && s.kind === "yield");

const egoLight = (facts: SceneFacts): LightFact | undefined =>
  facts.lights.find((l) => l.appliesTo === "ego" && (l.state === "red" || l.state === "green"));

const zebraAhead = (facts: SceneFacts): boolean => facts.markings.some((m) => m.kind === "zebra_crossing" && m.appliesTo === "ego");
const pedestrianOnCrossing = (facts: SceneFacts): boolean => facts.roadUsers.some((u) => u.kind === "pedestrian" && u.position === "on_crossing_ahead");
const pedestrianInPath = (facts: SceneFacts): boolean =>
  facts.roadUsers.some((u) => u.kind === "pedestrian" && (u.position === "on_crossing_ahead" || u.position === "in_path_ahead"));
const emergencyVehicle = (facts: SceneFacts): boolean => facts.roadUsers.some((u) => u.kind === "emergency_vehicle");

/** The one person a what-if may add: onto the zebra crossing when there is one, else stepping into the road in front. */
function pedestrianEdit(facts: SceneFacts): WhatIfEdit | null {
  if (zebraAhead(facts)) return pedestrianOnCrossing(facts) ? null : { kind: "add_pedestrian_on_crossing" };
  return pedestrianInPath(facts) ? null : { kind: "add_pedestrian_ahead" };
}

/**
 * Every edit that would change the answer: what a typed what-if may ask for. The order sets the four
 * chips: the ambulance before the person in front, so the examples' verified ambulances keep a chip.
 */
export function offerableEdits(facts: SceneFacts): WhatIfEdit[] {
  const sign = egoSign(facts);
  const light = egoLight(facts);
  const candidates: (WhatIfEdit | null)[] = [
    sign ? { kind: "swap_sign", factId: sign.id, to: sign.kind === "stop" ? "yield" : "stop" } : null,
    sign ? { kind: "remove_sign", factId: sign.id } : null,
    light ? { kind: "set_light", factId: light.id, to: light.state === "green" ? "red" : "green" } : null,
    emergencyVehicle(facts) ? null : { kind: "add_emergency_vehicle" },
    pedestrianEdit(facts),
  ];
  return candidates.filter((edit): edit is WhatIfEdit => edit !== null);
}

/** The first four of them: the chips the page offers. */
export function proposeEdits(facts: SceneFacts): WhatIfEdit[] {
  return offerableEdits(facts).slice(0, MAX_EDITS);
}

const PEDESTRIAN_KINDS: ReadonlySet<string> = new Set(["add_pedestrian_on_crossing", "add_pedestrian_ahead"]);

/**
 * Whether an edit is what the learner asked for: the same kind, and the same direction when they
 * named one. A person in front is either pedestrian edit: the photo decides whether it's a crossing.
 */
export function matchesEdit(match: WhatIfMatch, edit: WhatIfEdit): boolean {
  if (match.kind !== edit.kind && !(PEDESTRIAN_KINDS.has(match.kind) && PEDESTRIAN_KINDS.has(edit.kind))) return false;
  if (!("to" in match) || match.to === undefined) return true;
  return "to" in edit && edit.to === match.to;
}

/** Why a typed what-if can't run on a photo: one sentence on the page for each. */
export const NOT_OFFERED_CAUSES = [
  "no_light",
  "no_sign",
  "light_already_red",
  "light_already_green",
  "sign_already_stop",
  "sign_already_yield",
  "pedestrian_already",
  "emergency_already",
  "cant_change",
] as const;
export type NotOfferedCause = (typeof NOT_OFFERED_CAUSES)[number];

const anyEgo = (items: readonly { appliesTo: string }[]): boolean => items.some((item) => item.appliesTo === "ego");

/**
 * Why no offerable edit matches the learner's request, or null when one does. A light
 * that isn't red or green, or a sign that isn't a STOP or yield sign, can't be changed.
 */
export function whyNotOffered(match: Exclude<WhatIfMatch, { kind: "none" }>, facts: SceneFacts): NotOfferedCause | null {
  switch (match.kind) {
    case "set_light": {
      if (!anyEgo(facts.lights)) return "no_light";
      const light = egoLight(facts);
      if (!light) return "cant_change";
      if (match.to !== light.state) return null;
      return light.state === "red" ? "light_already_red" : "light_already_green";
    }
    case "swap_sign":
    case "remove_sign": {
      if (!anyEgo(facts.signs)) return "no_sign";
      const sign = egoSign(facts);
      if (!sign) return "cant_change";
      if (match.kind !== "swap_sign" || match.to !== sign.kind) return null;
      return sign.kind === "stop" ? "sign_already_stop" : "sign_already_yield";
    }
    case "add_pedestrian_on_crossing":
    case "add_pedestrian_ahead":
      return pedestrianEdit(facts) ? null : "pedestrian_already";
    case "add_emergency_vehicle":
      return emergencyVehicle(facts) ? "emergency_already" : null;
  }
}

export function editKey(edit: WhatIfEdit): string {
  switch (edit.kind) {
    case "swap_sign":
    case "set_light":
      return `${edit.kind}:${edit.factId}:${edit.to}`;
    case "remove_sign":
      return `${edit.kind}:${edit.factId}`;
    default:
      return edit.kind;
  }
}
