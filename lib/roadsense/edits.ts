import type { LightFact, SceneFacts, SignFact, WhatIfEdit } from "./types";

// Which what-if edits a scene offers. Kept apart from whatif.ts, which runs the
// edits, so the /roadsense page can offer live chips without the model client.

const MAX_EDITS = 4;

/** The sign an edit acts on: the learner's STOP sign, else their yield sign. */
const egoSign = (facts: SceneFacts): SignFact | undefined =>
  facts.signs.find((s) => s.appliesTo === "ego" && s.kind === "stop") ?? facts.signs.find((s) => s.appliesTo === "ego" && s.kind === "yield");

const egoLight = (facts: SceneFacts): LightFact | undefined =>
  facts.lights.find((l) => l.appliesTo === "ego" && (l.state === "red" || l.state === "green"));

/** Up to four edits that would change the answer, most telling first. */
export function proposeEdits(facts: SceneFacts): WhatIfEdit[] {
  const sign = egoSign(facts);
  const light = egoLight(facts);
  const zebraAhead = facts.markings.some((m) => m.kind === "zebra_crossing" && m.appliesTo === "ego");
  const pedestrianOnCrossing = facts.roadUsers.some((u) => u.kind === "pedestrian" && u.position === "on_crossing_ahead");
  const emergencyVehicle = facts.roadUsers.some((u) => u.kind === "emergency_vehicle");
  const candidates: (WhatIfEdit | null)[] = [
    sign ? { kind: "swap_sign", factId: sign.id, to: sign.kind === "stop" ? "yield" : "stop" } : null,
    sign ? { kind: "remove_sign", factId: sign.id } : null,
    light ? { kind: "set_light", factId: light.id, to: light.state === "green" ? "red" : "green" } : null,
    zebraAhead && !pedestrianOnCrossing ? { kind: "add_pedestrian_on_crossing" } : null,
    emergencyVehicle ? null : { kind: "add_emergency_vehicle" },
  ];
  return candidates.filter((edit): edit is WhatIfEdit => edit !== null).slice(0, MAX_EDITS);
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
