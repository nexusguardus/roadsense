import type { EngineVerdict, LightFact, Obligation, RoadUserFact, SceneFacts, UnknownCode } from "./types";

// What the learner (the camera) must do, decided from perceived facts alone.
// The first matching rule wins; the order follows RGC art. 133 (officers and
// lights outrank vertical signs, which outrank markings) and arts. 56-57, 65,
// 67-69. docs/roadsense/RULES.md has the table with the reasoning for each row.

function decided(obligation: Obligation, ruleIds: string[], criticalFactIds: string[]): EngineVerdict {
  return { status: "decided", obligation, ruleIds, criticalFactIds, missing: [] };
}

function insufficient(missing: UnknownCode[]): EngineVerdict {
  return { status: "insufficient", obligation: null, ruleIds: [], criticalFactIds: [], missing };
}

function outOfScope(): EngineVerdict {
  return { status: "out_of_scope", obligation: null, ruleIds: [], criticalFactIds: [], missing: [] };
}

const LIGHT_SEVERITY: Record<"red" | "amber" | "green", number> = { red: 0, amber: 1, green: 2 };

/** The light that governs the learner's approach: the strictest steady red, amber or green aimed at it. */
function governingLight(facts: SceneFacts): LightFact | undefined {
  return facts.lights
    .filter((light) => light.appliesTo === "ego" && light.state in LIGHT_SEVERITY)
    .sort((a, b) => LIGHT_SEVERITY[a.state as keyof typeof LIGHT_SEVERITY] - LIGHT_SEVERITY[b.state as keyof typeof LIGHT_SEVERITY])[0];
}

const VEHICLES: ReadonlySet<RoadUserFact["kind"]> = new Set(["car", "motorcycle", "bicycle", "emergency_vehicle"]);

function decide(facts: SceneFacts): EngineVerdict {
  const unknown = (code: UnknownCode) => facts.unknowns.includes(code);

  // A reason given with inScope true is contradictory output: take the cautious reading.
  if (!facts.inScope || facts.outOfScopeReason !== null) return outOfScope();

  const emergency = facts.roadUsers.find((u) => u.kind === "emergency_vehicle" && u.emergencyLightsOn);
  if (emergency) return decided("yield_to_emergency_vehicle", ["rgc-67-1", "rgc-69"], [emergency.id]);

  if (unknown("junction_unclear")) return insufficient(["junction_unclear"]);
  if (unknown("light_state_unclear")) return insufficient(["light_state_unclear"]);

  // Art. 56 is about intersections: away from one, lights still bind (Anexo I 4.2) but 56.3 is not cited.
  const atJunction = facts.junction !== "none";
  const lightAtJunction = atJunction ? ["rgc-56-3"] : [];
  const pedestrian = facts.roadUsers.find((u) => u.kind === "pedestrian" && u.position === "on_crossing_ahead");
  // Off a marked crossing art. 65.1.a doesn't apply, but art. 46.1.a still requires slowing down and stopping if needed.
  const inPath = facts.roadUsers.find((u) => u.kind === "pedestrian" && u.position === "in_path_ahead");
  const light = governingLight(facts);
  if (light?.state === "red") return decided("stop_at_light", [...lightAtJunction, "anexo-i-light-red", "rgc-133-1"], [light.id]);
  if (light?.state === "amber") return decided("stop_at_light", [...lightAtJunction, "anexo-i-light-amber", "rgc-133-1"], [light.id]);
  if (light?.state === "green") {
    // Pedestrian priority on a crossing applies "con independencia de otros supuestos" (art. 65.1)
    // while green gives priority (Anexo I 4.2.e): the corpus does not settle which wins, so say so.
    if (pedestrian) return insufficient([]);
    return decided("proceed", [...lightAtJunction, "anexo-i-light-green", "rgc-133-1", "rgc-59-1"], [light.id]);
  }

  const egoSigns = facts.signs.filter((s) => s.appliesTo === "ego");
  const egoMarks = facts.markings.filter((m) => m.appliesTo === "ego");
  const stopSign = egoSigns.find((s) => s.kind === "stop");
  const yieldSign = egoSigns.find((s) => s.kind === "yield");
  const prioritySign = egoSigns.find((s) => s.kind === "priority_road");
  const stopWord = egoMarks.find((m) => m.kind === "stop_word");
  const stopLine = egoMarks.find((m) => m.kind === "stop_line");
  const yieldTriangle = egoMarks.find((m) => m.kind === "yield_triangle");
  const yieldLine = egoMarks.find((m) => m.kind === "yield_line");

  // Hidden signage could be a STOP the answer must include (art. 56.5), even with a pedestrian on the crossing.
  if (unknown("ego_signage_hidden")) return insufficient(["ego_signage_hidden"]);

  if (pedestrian) {
    // Art. 65.1.a covers marked crossings ("debidamente señalizados") only, and only one in the learner's path.
    const zebra = egoMarks.some((m) => m.kind === "zebra_crossing");
    const crossingSign = egoSigns.some((s) => s.kind === "pedestrian_crossing");
    if (!zebra && !crossingSign) return insufficient([]);
    const crossing = ["rgc-65-1-a", ...(zebra ? ["anexo-i-m-4-3"] : [])];
    // A STOP still requires the full stop (art. 56.5) on top of letting the pedestrians cross.
    const stop = atJunction ? (stopSign ?? stopWord) : undefined;
    if (stop) {
      return decided("stop_and_yield", ["rgc-56-1", "rgc-56-5", stopSign ? "rgc-133-1" : "anexo-i-m-6-3", ...crossing], [stop.id, pedestrian.id]);
    }
    return decided("yield_to_pedestrians", crossing, [pedestrian.id]);
  }

  // Away from a junction only a pedestrian in my path is left to decide on (art. 46.1.a).
  if (!atJunction) return inPath ? decided("slow_down_for_pedestrian", ["rgc-46-1-a"], [inPath.id]) : outOfScope();

  // A STOP and a yield indication on the same approach: art. 133.2 settles which one binds.
  const conflict = (stopSign || stopWord) && (yieldSign || yieldTriangle) ? ["rgc-133-2"] : [];
  if (stopSign) return decided("stop_and_yield", ["rgc-56-1", "rgc-56-5", "rgc-133-1", ...conflict], [stopSign.id]);
  if (yieldSign) return decided("yield", ["rgc-56-1", "rgc-56-5", "rgc-133-1", ...conflict], [yieldSign.id]);
  if (prioritySign) {
    const outranked = stopWord || yieldTriangle ? ["rgc-133-1", "rgc-133-2"] : [];
    return decided("proceed", ["rgc-56-1", "rgc-56-4", ...outranked], [prioritySign.id]);
  }
  if (stopWord) {
    return decided("stop_and_yield", ["rgc-56-1", "rgc-56-5", "anexo-i-m-6-3", ...(stopLine ? ["anexo-i-m-4-1"] : []), ...conflict], [stopWord.id]);
  }
  if (yieldTriangle) {
    return decided("yield", ["rgc-56-1", "rgc-56-5", "anexo-i-m-6-5", ...(yieldLine ? ["anexo-i-m-4-2"] : [])], [yieldTriangle.id]);
  }
  // A stop line only marks where to stop for a STOP sign, light, officer or crossing (Anexo I, M-4.1).
  // Alone, it points to a sign perception did not see.
  if (stopLine) return insufficient(["ego_signage_hidden"]);

  // "roundabout" means the learner is approaching the entry; a learner already on the ring is out of scope.
  if (facts.junction === "roundabout") {
    return decided(
      "yield",
      ["rgc-57-1-c"],
      facts.roadUsers.filter((u) => u.position === "inside_roundabout").map((u) => u.id),
    );
  }

  const onCrossRoad = (appliesTo: string) => appliesTo === "left" || appliesTo === "right";
  // A priority-road sign for the crossing road makes mine the minor road, but the corpus has no
  // rule for my duty without a sign of my own: say so rather than guess.
  if (facts.signs.some((s) => onCrossRoad(s.appliesTo) && s.kind === "priority_road")) return insufficient([]);

  // The crossing road has a STOP or yield of its own (sign or painted): its drivers give way to me
  // (art. 56.5). It binds only them: an unsigned road on my right keeps its priority (art. 57.1).
  // A line alone imposes nothing (Anexo I M-4.1, M-4.2).
  const crossSignals = [
    ...facts.signs.filter((s) => onCrossRoad(s.appliesTo) && (s.kind === "stop" || s.kind === "yield")),
    ...facts.markings.filter((m) => onCrossRoad(m.appliesTo) && (m.kind === "stop_word" || m.kind === "yield_triangle")),
  ];
  if (crossSignals.length > 0) {
    const rightSigned = crossSignals.some((signal) => signal.appliesTo === "right");
    const fromUnsignedRight = !rightSigned && facts.roadUsers.some((u) => u.position === "from_right" && VEHICLES.has(u.kind));
    if (!rightSigned && unknown("right_approach_hidden")) return insufficient(["right_approach_hidden"]);
    if (!fromUnsignedRight) return decided("proceed", ["rgc-56-1", "rgc-56-5"], crossSignals.map((signal) => signal.id));
  }

  const tram = facts.roadUsers.find((u) => u.kind === "tram" && u.position !== "behind");
  if (tram) return decided("yield", ["rgc-57-1-b"], [tram.id]);

  if (unknown("surface_unclear")) return insufficient(["surface_unclear"]);
  if (facts.egoRoadPaved === false && facts.crossRoadPaved === true) return decided("yield", ["rgc-57-1-a"], []);
  if (facts.egoRoadPaved === true && facts.crossRoadPaved === false) return decided("proceed", ["rgc-57-1-a"], []);

  if (unknown("right_approach_hidden")) return insufficient(["right_approach_hidden"]);
  const fromRight = facts.roadUsers.find((u) => u.position === "from_right" && VEHICLES.has(u.kind));
  if (fromRight) return decided("yield", ["rgc-57-1"], [fromRight.id]);
  // No duty to give way to anyone: art. 57.1 only binds towards vehicles on the right.
  return decided("proceed", ["rgc-57-1"], []);
}

/**
 * A pedestrian on the road in my path, off any marked crossing, never removes a duty to stop or
 * give way: the answer keeps it and cites art. 46.1.a too. Only a "go" becomes "slow down, and stop
 * if needed", the duty art. 46.1.a sets when pedestrians are on the part of the road in use.
 */
function withPedestrianInPath(facts: SceneFacts, verdict: EngineVerdict): EngineVerdict {
  const inPath = facts.roadUsers.find((u) => u.kind === "pedestrian" && u.position === "in_path_ahead");
  if (!inPath || verdict.status !== "decided" || verdict.obligation === null) return verdict;
  const obligation = verdict.obligation === "proceed" ? "slow_down_for_pedestrian" : verdict.obligation;
  return decided(obligation, [...new Set([...verdict.ruleIds, "rgc-46-1-a"])], [...new Set([...verdict.criticalFactIds, inPath.id])]);
}

export function decideObligation(facts: SceneFacts): EngineVerdict {
  const verdict = withPedestrianInPath(facts, decide(facts));
  // Flashing amber does not regulate the junction (Anexo I 4.2.d): the decision falls
  // through to the signs and general rules, and also cites what flashing amber means.
  const flashing = facts.lights.some((l) => l.appliesTo === "ego" && l.state === "amber_flashing");
  if (flashing && verdict.status === "decided") return { ...verdict, ruleIds: [...verdict.ruleIds, "anexo-i-light-amber-flashing"] };
  return verdict;
}
