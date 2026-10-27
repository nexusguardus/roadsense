// JSON schemas for Muse Spark structured output in strict mode: a plain object at
// the root, additionalProperties false and every property required at every level,
// nullable values as anyOf below the root (allOf/oneOf are not supported).
import { RoadsenseValidationError } from "./errors";
import {
  APPROACHES,
  JUNCTION_TYPES,
  LIGHT_STATES,
  MARKING_KINDS,
  OBLIGATIONS,
  OUT_OF_SCOPE_REASONS,
  ROAD_USER_KINDS,
  ROAD_USER_POSITIONS,
  SIGN_KINDS,
  UNKNOWN_CODES,
} from "./vocabulary";

type Schema = Record<string, unknown>;

const object = (properties: Record<string, Schema>): Schema => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const choice = (values: readonly string[]): Schema => ({ type: "string", enum: [...values] });
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: "null" }] });
const array = (items: Schema): Schema => ({ type: "array", items });

const STRING: Schema = { type: "string" };
const NUMBER: Schema = { type: "number" };
const BOOLEAN: Schema = { type: "boolean" };
const BOX = object({ x1: NUMBER, y1: NUMBER, x2: NUMBER, y2: NUMBER });

export const PERCEPTION_SCHEMA: Schema = object({
  inScope: BOOLEAN,
  outOfScopeReason: nullable(choice(OUT_OF_SCOPE_REASONS)),
  junction: choice(JUNCTION_TYPES),
  egoRoadPaved: nullable(BOOLEAN),
  crossRoadPaved: nullable(BOOLEAN),
  signs: array(object({ id: STRING, kind: choice(SIGN_KINDS), appliesTo: choice(APPROACHES), box: BOX, confidence: NUMBER })),
  lights: array(object({ id: STRING, state: choice(LIGHT_STATES), appliesTo: choice(APPROACHES), box: BOX, confidence: NUMBER })),
  markings: array(
    object({ id: STRING, kind: choice(MARKING_KINDS), appliesTo: choice(APPROACHES), box: BOX, confidence: NUMBER }),
  ),
  roadUsers: array(
    object({
      id: STRING,
      kind: choice(ROAD_USER_KINDS),
      position: choice(ROAD_USER_POSITIONS),
      emergencyLightsOn: BOOLEAN,
      box: BOX,
      confidence: NUMBER,
    }),
  ),
  unknowns: array(choice(UNKNOWN_CODES)),
});

/** The second look at critical facts when SAM is not used: is each one there, and where. */
export const VERIFY_SCHEMA: Schema = object({
  checks: array(object({ factId: STRING, present: BOOLEAN, box: nullable(BOX) })),
});

/** The decision schema; the model can only cite the rule ids it was given. */
export function decisionSchema(ruleIds: readonly string[]): Schema {
  if (ruleIds.length === 0) throw new RoadsenseValidationError("decisionSchema needs at least one rule id");
  return object({
    obligation: choice(OBLIGATIONS),
    priorityTo: array(STRING),
    rationale: STRING,
    temptingWrongAnswer: STRING,
    whyWrong: STRING,
    ruleIds: array(choice(ruleIds)),
  });
}
