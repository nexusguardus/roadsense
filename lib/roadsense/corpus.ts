import { createHash } from "node:crypto";
import { RoadsenseValidationError } from "./errors";
import type { RoadsenseLocale, RuleRecord } from "./types";

/**
 * Every rule RoadSense may cite. Art. 56.4 and 56.5 carry the priority-road and
 * yield/STOP rules: since RD 465/2025 the BOE shows the vertical-sign catalogue
 * as images, so those signs are cited through the article text instead.
 */
export const RULE_IDS = [
  "rgc-56-1",
  "rgc-56-3",
  "rgc-56-4",
  "rgc-56-5",
  "rgc-57-1",
  "rgc-57-1-a",
  "rgc-57-1-b",
  "rgc-57-1-c",
  "rgc-58-1",
  "rgc-59-1",
  "rgc-65-1-a",
  "rgc-67-1",
  "rgc-69",
  "rgc-133-1",
  "rgc-133-2",
  "anexo-i-light-red",
  "anexo-i-light-amber",
  "anexo-i-light-amber-flashing",
  "anexo-i-light-green",
  "anexo-i-m-4-1",
  "anexo-i-m-4-2",
  "anexo-i-m-4-3",
  "anexo-i-m-6-3",
  "anexo-i-m-6-5",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

const LOCALES: readonly RoadsenseLocale[] = ["es", "en", "fr", "ar"];
const BOE_URL_PREFIX = "https://www.boe.es/buscar/act.php?id=BOE-A-2003-23514#";

function text(record: Record<string, unknown>, key: string, where: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new RoadsenseValidationError(`${where}: ${key} must be a non-empty string`);
  }
  return value;
}

function toRule(raw: unknown, index: number): RuleRecord {
  if (typeof raw !== "object" || raw === null) throw new RoadsenseValidationError(`corpus[${index}] is not an object`);
  const record = raw as Record<string, unknown>;
  const where = `corpus[${index}]`;
  const id = text(record, "id", where);
  if (!(RULE_IDS as readonly string[]).includes(id)) throw new RoadsenseValidationError(`${where}: unknown rule id ${id}`);
  if (record.law !== "RGC") throw new RoadsenseValidationError(`${id}: law must be "RGC"`);
  const boeBlockId = text(record, "boeBlockId", id);
  const excerptEs = text(record, "excerptEs", id);
  const boeUrl = text(record, "boeUrl", id);
  if (boeUrl !== BOE_URL_PREFIX + boeBlockId) throw new RoadsenseValidationError(`${id}: boeUrl must point at #${boeBlockId}`);
  const versionDate = text(record, "versionDate", id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(versionDate)) throw new RoadsenseValidationError(`${id}: versionDate must be YYYY-MM-DD`);
  const sha256 = text(record, "sha256", id);
  if (createHash("sha256").update(excerptEs, "utf8").digest("hex") !== sha256) {
    throw new RoadsenseValidationError(`${id}: sha256 does not match the excerpt`);
  }
  const rawExplanation = record.explanation;
  if (typeof rawExplanation !== "object" || rawExplanation === null) {
    throw new RoadsenseValidationError(`${id}: explanation must be an object`);
  }
  const explanation = {} as Record<RoadsenseLocale, string>;
  for (const locale of LOCALES) explanation[locale] = text(rawExplanation as Record<string, unknown>, locale, `${id}.explanation`);
  return {
    id,
    law: "RGC",
    boeBlockId,
    article: text(record, "article", id),
    title: text(record, "title", id),
    excerptEs,
    boeUrl,
    versionDate,
    sha256,
    explanation,
  };
}

/** Validates corpus JSON; every record must be complete and its excerpt must match its hash. */
export function corpusFrom(data: unknown): RuleRecord[] {
  if (!Array.isArray(data)) throw new RoadsenseValidationError("corpus must be an array");
  const rules = data.map(toRule);
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) throw new RoadsenseValidationError(`duplicate rule id ${rule.id}`);
    seen.add(rule.id);
  }
  return rules;
}

/** The records for `ids`, in the order given. An id missing from the corpus is an error. */
export function rulesByIds(corpus: readonly RuleRecord[], ids: readonly string[]): RuleRecord[] {
  const byId = new Map(corpus.map((rule) => [rule.id, rule]));
  return ids.map((id) => {
    const rule = byId.get(id);
    if (!rule) throw new RoadsenseValidationError(`rule ${id} is not in the corpus`);
    return rule;
  });
}
