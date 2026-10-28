// Shared RoadSense types. Nothing here imports from the rest of DriveIQ.

export type RoadsenseLocale = "es" | "en" | "fr" | "ar";

/** One rule RoadSense may cite: a verbatim excerpt of the BOE consolidated text of the RGC. */
export interface RuleRecord {
  id: string;
  law: "RGC";
  /** BOE open-data block id, e.g. "a57" or "A4" (Anexo I §4). */
  boeBlockId: string;
  article: string;
  title: string;
  excerptEs: string;
  boeUrl: string;
  /** fecha_vigencia of the block version the excerpt comes from, YYYY-MM-DD. */
  versionDate: string;
  /** sha256 hex of excerptEs (UTF-8). */
  sha256: string;
  /** Plain-language explanations; shown as explanations, never as the law. */
  explanation: Record<RoadsenseLocale, string>;
}

/** A box on the 0-1000 grid Muse Spark uses for grounding, origin at the top left. */
export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type JunctionType = "crossroads" | "t_junction" | "roundabout" | "none";
export type SignKind = "yield" | "stop" | "priority_road" | "pedestrian_crossing" | "other";
export type MarkingKind = "stop_line" | "yield_line" | "stop_word" | "yield_triangle" | "zebra_crossing";
export type LightState = "red" | "amber" | "green" | "amber_flashing" | "off";
/** Which approach a sign, light or marking governs, seen from the learner (the camera). */
export type Approach = "ego" | "left" | "right" | "ahead";
export type RoadUserKind = "car" | "motorcycle" | "bicycle" | "pedestrian" | "tram" | "emergency_vehicle";
export type RoadUserPosition = "from_right" | "from_left" | "oncoming" | "inside_roundabout" | "on_crossing_ahead" | "in_path_ahead" | "behind";
/** Something perception could not see well enough to report as a fact. */
export type UnknownCode = "ego_signage_hidden" | "light_state_unclear" | "junction_unclear" | "right_approach_hidden" | "surface_unclear";

export interface SignFact {
  id: string;
  kind: SignKind;
  appliesTo: Approach;
  box: Box;
  confidence: number;
}

export interface LightFact {
  id: string;
  state: LightState;
  appliesTo: Approach;
  box: Box;
  confidence: number;
}

export interface MarkingFact {
  id: string;
  kind: MarkingKind;
  appliesTo: Approach;
  box: Box;
  confidence: number;
}

export interface RoadUserFact {
  id: string;
  kind: RoadUserKind;
  position: RoadUserPosition;
  emergencyLightsOn: boolean;
  box: Box;
  confidence: number;
}

export type SceneFact = SignFact | LightFact | MarkingFact | RoadUserFact;

export interface SceneFacts {
  inScope: boolean;
  outOfScopeReason: "not_spain" | "no_junction" | "traffic_officer" | "other" | null;
  junction: JunctionType;
  egoRoadPaved: boolean | null;
  crossRoadPaved: boolean | null;
  signs: SignFact[];
  lights: LightFact[];
  markings: MarkingFact[];
  roadUsers: RoadUserFact[];
  unknowns: UnknownCode[];
}

export type Obligation =
  | "proceed"
  | "yield"
  | "stop_and_yield"
  | "stop_at_light"
  | "yield_to_pedestrians"
  | "yield_to_emergency_vehicle"
  | "slow_down_for_pedestrian";

export interface EngineVerdict {
  status: "decided" | "insufficient" | "out_of_scope";
  obligation: Obligation | null;
  ruleIds: string[];
  criticalFactIds: string[];
  missing: UnknownCode[];
}

export interface ModelDecision {
  obligation: Obligation;
  priorityTo: string[];
  rationale: string;
  temptingWrongAnswer: string;
  whyWrong: string;
  ruleIds: string[];
}

export interface EvidenceCheck {
  factId: string;
  concept: string;
  confirmed: boolean;
  factBox: Box;
  /** The confirming box; null when the fact is not confirmed. */
  matchedBox: Box | null;
  /** Best overlap over the smaller box among detections of a comparable size (0 when none). */
  overlap: number;
}

export type Certainty = "checked" | "disagree" | "not_sure" | "outside_scope";

export interface AnalysisResult {
  certainty: Certainty;
  facts: SceneFacts;
  evidence: EvidenceCheck[];
  engine: EngineVerdict;
  model: ModelDecision | null;
  rules: RuleRecord[];
  costUsd: number;
  latencyMs: number;
  modelIds: string[];
}

export type WhatIfEdit =
  | { kind: "swap_sign"; factId: string; to: "yield" | "stop" }
  | { kind: "remove_sign"; factId: string }
  | { kind: "set_light"; factId: string; to: "red" | "green" }
  | { kind: "add_emergency_vehicle" }
  | { kind: "add_pedestrian_on_crossing" }
  | { kind: "add_pedestrian_ahead" };

/** What a learner's typed what-if asks for: one of the edits, maybe without a direction, or nothing RoadSense can test. */
export type WhatIfMatch =
  | { kind: "swap_sign"; to?: "stop" | "yield" }
  | { kind: "set_light"; to?: "red" | "green" }
  | { kind: "remove_sign" | "add_pedestrian_on_crossing" | "add_pedestrian_ahead" | "add_emergency_vehicle" }
  | { kind: "none" };

export interface CuratedScene {
  id: string;
  family: string;
  title: Record<RoadsenseLocale, string>;
  imagePath: string;
  facts: SceneFacts;
  expected: { kind: "answerable" | "abstain" | "out_of_scope"; obligation: Obligation | null; ruleIds: string[] };
  /** False for scenes whose precomputed result is wrong: they stay in the evaluation, not in the picker. */
  shown: boolean;
  precomputed: Record<RoadsenseLocale, AnalysisResult>;
  whatIfs: { key: string; edit: WhatIfEdit; imagePath: string; precomputed: Record<RoadsenseLocale, AnalysisResult> }[];
}
