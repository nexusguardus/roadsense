import { RoadsenseValidationError } from "./errors";
import type { Box, LightFact, MarkingFact, RoadUserFact, SceneFact, SceneFacts, SignFact } from "./types";
import {
  APPROACHES,
  JUNCTION_TYPES,
  LIGHT_STATES,
  MARKING_KINDS,
  OUT_OF_SCOPE_REASONS,
  ROAD_USER_KINDS,
  ROAD_USER_POSITIONS,
  SIGN_KINDS,
  UNKNOWN_CODES,
} from "./vocabulary";

type Raw = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new RoadsenseValidationError(`${path}: ${message}`);
}

function object(value: unknown, path: string): Raw {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "must be an object");
  return value as Raw;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "must be an array");
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    fail(path, `must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "must be a boolean");
  return value;
}

function boolOrNull(value: unknown, path: string): boolean | null {
  return value === null ? null : bool(value, path);
}

function number(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "must be a number");
  return value;
}

function factId(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(path, "must be a non-empty string");
  return value;
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/** Grid values can come back slightly outside 0-1000, so they are clamped; a flipped box is put right. */
export function parseBox(value: unknown, path: string): Box {
  const raw = object(value, path);
  const x1 = clamp(number(raw.x1, `${path}.x1`), 0, 1000);
  const y1 = clamp(number(raw.y1, `${path}.y1`), 0, 1000);
  const x2 = clamp(number(raw.x2, `${path}.x2`), 0, 1000);
  const y2 = clamp(number(raw.y2, `${path}.y2`), 0, 1000);
  return { x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2) };
}

const confidence = (value: unknown, path: string): number => clamp(number(value, path), 0, 1);

function sign(value: unknown, path: string): SignFact {
  const raw = object(value, path);
  return {
    id: factId(raw.id, `${path}.id`),
    kind: oneOf(raw.kind, SIGN_KINDS, `${path}.kind`),
    appliesTo: oneOf(raw.appliesTo, APPROACHES, `${path}.appliesTo`),
    box: parseBox(raw.box, `${path}.box`),
    confidence: confidence(raw.confidence, `${path}.confidence`),
  };
}

function light(value: unknown, path: string): LightFact {
  const raw = object(value, path);
  return {
    id: factId(raw.id, `${path}.id`),
    state: oneOf(raw.state, LIGHT_STATES, `${path}.state`),
    appliesTo: oneOf(raw.appliesTo, APPROACHES, `${path}.appliesTo`),
    box: parseBox(raw.box, `${path}.box`),
    confidence: confidence(raw.confidence, `${path}.confidence`),
  };
}

function marking(value: unknown, path: string): MarkingFact {
  const raw = object(value, path);
  return {
    id: factId(raw.id, `${path}.id`),
    kind: oneOf(raw.kind, MARKING_KINDS, `${path}.kind`),
    appliesTo: oneOf(raw.appliesTo, APPROACHES, `${path}.appliesTo`),
    box: parseBox(raw.box, `${path}.box`),
    confidence: confidence(raw.confidence, `${path}.confidence`),
  };
}

function roadUser(value: unknown, path: string): RoadUserFact {
  const raw = object(value, path);
  return {
    id: factId(raw.id, `${path}.id`),
    kind: oneOf(raw.kind, ROAD_USER_KINDS, `${path}.kind`),
    position: oneOf(raw.position, ROAD_USER_POSITIONS, `${path}.position`),
    emergencyLightsOn: bool(raw.emergencyLightsOn, `${path}.emergencyLightsOn`),
    box: parseBox(raw.box, `${path}.box`),
    confidence: confidence(raw.confidence, `${path}.confidence`),
  };
}

/** Validates perception output (or stored ground truth) into SceneFacts. Unknown values and missing fields throw. */
export function parseSceneFacts(data: unknown): SceneFacts {
  const raw = object(data, "facts");
  const facts: SceneFacts = {
    inScope: bool(raw.inScope, "facts.inScope"),
    outOfScopeReason:
      raw.outOfScopeReason === null ? null : oneOf(raw.outOfScopeReason, OUT_OF_SCOPE_REASONS, "facts.outOfScopeReason"),
    junction: oneOf(raw.junction, JUNCTION_TYPES, "facts.junction"),
    egoRoadPaved: boolOrNull(raw.egoRoadPaved, "facts.egoRoadPaved"),
    crossRoadPaved: boolOrNull(raw.crossRoadPaved, "facts.crossRoadPaved"),
    signs: list(raw.signs, "facts.signs").map((item, i) => sign(item, `facts.signs[${i}]`)),
    lights: list(raw.lights, "facts.lights").map((item, i) => light(item, `facts.lights[${i}]`)),
    markings: list(raw.markings, "facts.markings").map((item, i) => marking(item, `facts.markings[${i}]`)),
    roadUsers: list(raw.roadUsers, "facts.roadUsers").map((item, i) => roadUser(item, `facts.roadUsers[${i}]`)),
    unknowns: [
      ...new Set(list(raw.unknowns, "facts.unknowns").map((item, i) => oneOf(item, UNKNOWN_CODES, `facts.unknowns[${i}]`))),
    ],
  };
  const ids = [...facts.signs, ...facts.lights, ...facts.markings, ...facts.roadUsers].map((fact) => fact.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate !== undefined) fail("facts", `duplicate fact id ${duplicate}`);
  return facts;
}

/** The sign, light, marking or road user with this id, if perception reported one. */
export function factById(facts: SceneFacts, id: string): SceneFact | undefined {
  return [...facts.signs, ...facts.lights, ...facts.markings, ...facts.roadUsers].find((fact) => fact.id === id);
}
