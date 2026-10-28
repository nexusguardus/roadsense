import type {
  Approach,
  JunctionType,
  LightState,
  MarkingKind,
  Obligation,
  RoadUserKind,
  RoadUserPosition,
  SceneFacts,
  SignKind,
  UnknownCode,
} from "./types";

// Each list is built from a record keyed by every member of its union, so
// TypeScript rejects a missing or extra value and the lists cannot drift.
const keys = <K extends string>(record: Record<K, true>): readonly K[] => Object.keys(record) as K[];

export const JUNCTION_TYPES = keys<JunctionType>({ crossroads: true, t_junction: true, roundabout: true, none: true });
export const SIGN_KINDS = keys<SignKind>({ yield: true, stop: true, priority_road: true, pedestrian_crossing: true, other: true });
export const MARKING_KINDS = keys<MarkingKind>({
  stop_line: true,
  yield_line: true,
  stop_word: true,
  yield_triangle: true,
  zebra_crossing: true,
});
export const LIGHT_STATES = keys<LightState>({ red: true, amber: true, green: true, amber_flashing: true, off: true });
export const APPROACHES = keys<Approach>({ ego: true, left: true, right: true, ahead: true });
export const ROAD_USER_KINDS = keys<RoadUserKind>({
  car: true,
  motorcycle: true,
  bicycle: true,
  pedestrian: true,
  tram: true,
  emergency_vehicle: true,
});
export const ROAD_USER_POSITIONS = keys<RoadUserPosition>({
  from_right: true,
  from_left: true,
  oncoming: true,
  inside_roundabout: true,
  on_crossing_ahead: true,
  in_path_ahead: true,
  behind: true,
});
export const UNKNOWN_CODES = keys<UnknownCode>({
  ego_signage_hidden: true,
  light_state_unclear: true,
  junction_unclear: true,
  right_approach_hidden: true,
  surface_unclear: true,
});
export const OUT_OF_SCOPE_REASONS = keys<NonNullable<SceneFacts["outOfScopeReason"]>>({
  not_spain: true,
  no_junction: true,
  traffic_officer: true,
  other: true,
});
export const OBLIGATIONS = keys<Obligation>({
  proceed: true,
  yield: true,
  stop_and_yield: true,
  stop_at_light: true,
  yield_to_pedestrians: true,
  yield_to_emergency_vehicle: true,
  slow_down_for_pedestrian: true,
});

/**
 * Official catalogue codes, only where the BOE text names them (RGC Anexo I §5).
 * Since RD 465/2025 the vertical-sign catalogue is published as images, so the
 * priority-road and pedestrian-crossing sign codes have no text to confirm them.
 */
export const OFFICIAL_CODES: {
  sign: Record<Exclude<SignKind, "other">, string | null>;
  marking: Record<MarkingKind, string>;
} = {
  sign: { yield: "R-1", stop: "R-2", priority_road: null, pedestrian_crossing: null },
  marking: {
    stop_line: "M-4.1",
    yield_line: "M-4.2",
    stop_word: "M-6.3",
    yield_triangle: "M-6.5",
    zebra_crossing: "M-4.3",
  },
};

/** A fact a decision depends on is trusted only at or above this confidence. */
export const MIN_FACT_CONFIDENCE = 0.6;
