import { RoadsenseValidationError } from "./errors";
import { parseSceneFacts } from "./facts";
import type { AnalysisResult, CuratedScene, Obligation, RoadsenseLocale, WhatIfEdit } from "./types";
import { OBLIGATIONS } from "./vocabulary";

type Raw = Record<string, unknown>;

const LOCALES: readonly RoadsenseLocale[] = ["es", "en", "fr", "ar"];
const EXPECTED_KINDS = ["answerable", "abstain", "out_of_scope"] as const;
const EDIT_KINDS: readonly WhatIfEdit["kind"][] = [
  "swap_sign",
  "remove_sign",
  "set_light",
  "add_emergency_vehicle",
  "add_pedestrian_on_crossing",
];
const CERTAINTIES: readonly AnalysisResult["certainty"][] = ["checked", "disagree", "not_sure", "outside_scope"];

function fail(path: string, message: string): never {
  throw new RoadsenseValidationError(`${path}: ${message}`);
}

function object(value: unknown, path: string): Raw {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "must be an object");
  return value as Raw;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(path, "must be a non-empty string");
  return value;
}

function imagePath(value: unknown, path: string): string {
  const image = text(value, path);
  if (!image.startsWith("/roadsense/")) fail(path, "must be under /roadsense/");
  return image;
}

function perLocale<T>(value: unknown, path: string, read: (item: unknown, itemPath: string) => T): Record<RoadsenseLocale, T> {
  const raw = object(value, path);
  const out = {} as Record<RoadsenseLocale, T>;
  for (const locale of LOCALES) out[locale] = read(raw[locale], `${path}.${locale}`);
  return out;
}

/** Precomputed results come from our own precompute script; only their certainty is checked here. */
function result(value: unknown, path: string): AnalysisResult {
  const raw = object(value, path);
  if (!CERTAINTIES.includes(raw.certainty as AnalysisResult["certainty"])) fail(`${path}.certainty`, "unknown certainty");
  return raw as unknown as AnalysisResult;
}

function edit(value: unknown, path: string): WhatIfEdit {
  const raw = object(value, path);
  if (!EDIT_KINDS.includes(raw.kind as WhatIfEdit["kind"])) fail(`${path}.kind`, "unknown edit kind");
  return raw as unknown as WhatIfEdit;
}

function expected(value: unknown, path: string): CuratedScene["expected"] {
  const raw = object(value, path);
  const kind = raw.kind;
  if (typeof kind !== "string" || !(EXPECTED_KINDS as readonly string[]).includes(kind)) fail(`${path}.kind`, "unknown kind");
  const obligation = raw.obligation;
  if (obligation !== null && !(OBLIGATIONS as readonly string[]).includes(obligation as string)) {
    fail(`${path}.obligation`, "unknown obligation");
  }
  if (!Array.isArray(raw.ruleIds) || raw.ruleIds.some((id) => typeof id !== "string")) fail(`${path}.ruleIds`, "must be strings");
  return {
    kind: kind as CuratedScene["expected"]["kind"],
    obligation: obligation as Obligation | null,
    ruleIds: [...(raw.ruleIds as string[])],
  };
}

function scene(value: unknown, path: string): CuratedScene {
  const raw = object(value, path);
  let facts;
  try {
    facts = parseSceneFacts(raw.facts);
  } catch (err) {
    fail(path, err instanceof Error ? err.message : String(err));
  }
  if (typeof raw.shown !== "boolean") fail(`${path}.shown`, "must be a boolean");
  if (!Array.isArray(raw.whatIfs)) fail(`${path}.whatIfs`, "must be an array");
  return {
    id: text(raw.id, `${path}.id`),
    family: text(raw.family, `${path}.family`),
    title: perLocale(raw.title, `${path}.title`, text),
    imagePath: imagePath(raw.imagePath, `${path}.imagePath`),
    facts,
    expected: expected(raw.expected, `${path}.expected`),
    shown: raw.shown,
    precomputed: perLocale(raw.precomputed, `${path}.precomputed`, result),
    whatIfs: raw.whatIfs.map((item, i) => {
      const whatIf = object(item, `${path}.whatIfs[${i}]`);
      return {
        key: text(whatIf.key, `${path}.whatIfs[${i}].key`),
        edit: edit(whatIf.edit, `${path}.whatIfs[${i}].edit`),
        imagePath: imagePath(whatIf.imagePath, `${path}.whatIfs[${i}].imagePath`),
        precomputed: perLocale(whatIf.precomputed, `${path}.whatIfs[${i}].precomputed`, result),
      };
    }),
  };
}

/** The picker's small copy of a scene's image (scripts/roadsense/thumbnails.ts makes it). */
export function thumbnailPath(scene: Pick<CuratedScene, "id">): string {
  return `/roadsense/thumbs/${scene.id}.webp`;
}

/** Validates the curated scene index (data/roadsense/scenes/index.json). */
export function scenesFrom(data: unknown): CuratedScene[] {
  if (!Array.isArray(data)) fail("scenes", "must be an array");
  const scenes = data.map((item, i) => scene(item, `scenes[${i}]`));
  const ids = scenes.map((s) => s.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate !== undefined) fail("scenes", `duplicate scene id ${duplicate}`);
  return scenes;
}

/**
 * What-ifs review dropped ("<scene id>|<edit key>"), never generated again. conflict-2's red light
 * recoloured the bottom lamp, and Spanish heads have red on top; conflict-1's removed sign was read
 * as hidden signage the picture doesn't show (Task 13 of the build plan, 2026-10-26). crossing-1's
 * ambulance came out far ahead while a pedestrian crosses right in front, so "let the emergency
 * vehicle through" taught the wrong priority for that picture (redesign review, 2026-10-27).
 */
export const DROPPED_WHATIFS: readonly string[] = ["conflict-2|set_light:l1:red", "conflict-1|remove_sign:s1", "crossing-1|add_emergency_vehicle"];
