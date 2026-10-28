import { editKey, matchesEdit, offerableEdits, whyNotOffered, type NotOfferedCause } from "../../lib/roadsense/edits";
import { factById } from "../../lib/roadsense/facts";
import type { AnalysisResult, Box, Obligation, RuleRecord, SceneFacts, UnknownCode, WhatIfEdit, WhatIfMatch } from "../../lib/roadsense/types";
import type { AnalysisError } from "./useAnalysisStream";
import { MIN_FACT_CONFIDENCE } from "../../lib/roadsense/vocabulary";

// Pure helpers for the /roadsense page. The certainty rules themselves live in
// lib/roadsense/pipeline.ts (certaintyOf); these only explain a result.

const AMBER_RULE_ID = "anexo-i-light-amber";

const clamp = (value: number): number => Math.min(1000, Math.max(0, value));
const percent = (value: number): string => `${Math.round(value * 10) / 100}%`;

/** A box on the 0-1000 grid as CSS percentages of the photo it was read from. */
export function boxStyle(box: Box): { left: string; top: string; width: string; height: string } {
  const x1 = clamp(Math.min(box.x1, box.x2));
  const x2 = clamp(Math.max(box.x1, box.x2));
  const y1 = clamp(Math.min(box.y1, box.y2));
  const y2 = clamp(Math.max(box.y1, box.y2));
  return { left: percent(x1), top: percent(y1), width: percent(x2 - x1), height: percent(y2 - y1) };
}

export interface EvidenceOverlay {
  factId: string;
  box: Box;
  confirmed: boolean;
}

/** One outline per checked fact: SAM's box when it confirmed the fact, Muse Spark's otherwise. */
export function evidenceOverlays(result: AnalysisResult): EvidenceOverlay[] {
  return result.evidence.map((check) => ({
    factId: check.factId,
    box: check.confirmed && check.matchedBox ? check.matchedBox : check.factBox,
    confirmed: check.confirmed,
  }));
}

export type NotSureReason =
  | { kind: "unknown"; code: UnknownCode }
  | { kind: "nothing_to_confirm" }
  | { kind: "unconfirmed" }
  | { kind: "low_confidence" }
  | { kind: "no_explanation" }
  | { kind: "unsettled" };

/** Why a result is "not sure", in the order certaintyOf checks them. */
export function notSureReasons(result: AnalysisResult): NotSureReason[] {
  if (result.certainty !== "not_sure") return [];
  const { engine, evidence, facts, model } = result;
  if (engine.status !== "decided") {
    return engine.missing.length > 0 ? engine.missing.map((code) => ({ kind: "unknown", code })) : [{ kind: "unsettled" }];
  }
  if (engine.criticalFactIds.length === 0) return [{ kind: "nothing_to_confirm" }];
  const confirmed = (id: string) => evidence.some((check) => check.factId === id && check.confirmed);
  const reasons: NotSureReason[] = [];
  if (evidence.some((check) => !check.confirmed) || !engine.criticalFactIds.every(confirmed)) reasons.push({ kind: "unconfirmed" });
  if (engine.criticalFactIds.some((id) => (factById(facts, id)?.confidence ?? 0) < MIN_FACT_CONFIDENCE)) reasons.push({ kind: "low_confidence" });
  if (model === null) reasons.push({ kind: "no_explanation" });
  return reasons.length > 0 ? reasons : [{ kind: "unsettled" }];
}

/**
 * The rules a result shows: the engine's, then the ones the model cited. A "not
 * sure" result shows none, so the law shown never hints at an answer we withheld.
 */
export function rulesToShow(result: AnalysisResult): RuleRecord[] {
  if (result.certainty === "not_sure") return [];
  const cited = result.certainty === "outside_scope" ? [] : (result.model?.ruleIds ?? []);
  const ids = [...new Set([...result.engine.ruleIds, ...cited])];
  return ids.map((id) => result.rules.find((rule) => rule.id === id)).filter((rule): rule is RuleRecord => rule !== undefined);
}

/** Steady amber means stop unless you can no longer stop safely; say so whenever it decided the answer. */
export function showsAmberException(result: AnalysisResult): boolean {
  const shown = result.certainty === "checked" || result.certainty === "disagree";
  return shown && result.engine.status === "decided" && result.engine.ruleIds.includes(AMBER_RULE_ID);
}

/** What a "disagree" is about: different answers, or the same answer without the engine's rule. */
export function disagreement(result: AnalysisResult): "answers" | "citation" | null {
  if (result.certainty !== "disagree") return null;
  return result.model !== null && result.model.obligation === result.engine.obligation ? "citation" : "answers";
}

export type WhatIfLabelKey =
  | "swap_to_stop"
  | "swap_to_yield"
  | "remove_sign"
  | "light_red"
  | "light_green"
  | "add_emergency_vehicle"
  | "add_pedestrian_on_crossing";

export function whatIfLabelKey(edit: WhatIfEdit): WhatIfLabelKey {
  switch (edit.kind) {
    case "swap_sign":
      return edit.to === "stop" ? "swap_to_stop" : "swap_to_yield";
    case "set_light":
      return edit.to === "red" ? "light_red" : "light_green";
    default:
      return edit.kind;
  }
}

/** The size that keeps a photo's proportions with its longer side at most `max` pixels. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Whole NDJSON lines in `buffer`, and the unfinished line left over. */
export function splitLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.filter((line) => line.trim() !== ""), rest };
}

const STAGES = ["perceive", "check", "confirm", "retrieve", "decide", "edit"] as const;
const ERROR_CODES = ["timeout", "model", "internal"] as const;

export type StreamStage = (typeof STAGES)[number];
export type StreamErrorCode = (typeof ERROR_CODES)[number];
export type StreamLine =
  | { type: "stage"; stage: StreamStage }
  | { type: "result"; result: AnalysisResult | null; applied?: boolean; imageDataUrl?: string | null; refunded?: boolean }
  | { type: "error"; code: StreamErrorCode; refunded?: boolean };

/** One line of a live route's NDJSON stream, or null for anything this page doesn't know. */
export function parseStreamLine(text: string): StreamLine | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const line = value as Record<string, unknown>;
  if (line.type === "stage") {
    return (STAGES as readonly unknown[]).includes(line.stage) ? { type: "stage", stage: line.stage as StreamStage } : null;
  }
  if (line.type === "error") {
    if (!(ERROR_CODES as readonly unknown[]).includes(line.code)) return null;
    const code = line.code as StreamErrorCode;
    // Whether the failed analysis was given back; absent from older servers.
    return typeof line.refunded === "boolean" ? { type: "error", code, refunded: line.refunded } : { type: "error", code };
  }
  if (line.type === "result") return line as unknown as StreamLine;
  return null;
}

/** A bracketed run with Latin letters in it: a Spanish exam term such as "(ceda el paso)". */
const SPANISH_TERM = /(\([^()]*[A-Za-zÀ-ÿ][^()]*\))/;

/**
 * Splits text around Spanish terms in brackets. Arabic explanations keep those terms
 * (CLAUDE.md), and each must be isolated left-to-right or its brackets and words reorder.
 */
export function splitSpanishTerms(text: string): { text: string; spanish: boolean }[] {
  return text
    .split(SPANISH_TERM)
    .map((part, index) => ({ text: part, spanish: index % 2 === 1 }))
    .filter((part) => part.text !== "");
}

/** Replaces each {name} in a copy template with its value. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

// Typed what-ifs (2026-10-27 redesign). A learner's question, once read as a match
// (/api/roadsense/whatif/understand), runs only an edit the photo offers. Each question and
// its reply is a thread entry; a reply that arrives after another photo opened is dropped.

/** A what-if the page can run: its key and its edit. */
export interface WhatIfChip {
  key: string;
  edit: WhatIfEdit;
}

export type TypedResolution =
  | { outcome: "run"; chip: WhatIfChip }
  | { outcome: "not_possible"; cause: NotOfferedCause }
  | { outcome: "not_on_example" }
  | { outcome: "none" };

/**
 * What a typed what-if does on this photo. `ready` is an example's pre-generated what-ifs, matched by
 * kind and direction (their fact ids come from another reading of the photo), or null for the
 * learner's own photo, where any edit the photo offers can run live.
 */
export function resolveTypedWhatIf(match: WhatIfMatch, facts: SceneFacts, ready: readonly WhatIfChip[] | null): TypedResolution {
  if (match.kind === "none") return { outcome: "none" };
  const cause = whyNotOffered(match, facts);
  if (cause) return { outcome: "not_possible", cause };
  if (ready) {
    const chip = ready.find((candidate) => matchesEdit(match, candidate.edit));
    return chip ? { outcome: "run", chip } : { outcome: "not_on_example" };
  }
  const edit = offerableEdits(facts).find((candidate) => matchesEdit(match, candidate));
  return edit ? { outcome: "run", chip: { key: editKey(edit), edit } } : { outcome: "none" };
}

/** "Read as" for a typed what-if that can't run here: its label, when the match names enough to have one. */
export function matchLabelKey(match: WhatIfMatch): WhatIfLabelKey | null {
  switch (match.kind) {
    case "swap_sign":
      return match.to ? (match.to === "stop" ? "swap_to_stop" : "swap_to_yield") : null;
    case "set_light":
      return match.to ? (match.to === "red" ? "light_red" : "light_green") : null;
    case "none":
      return null;
    default:
      return match.kind;
  }
}

/** What an answer amounts to, for "Before → now": the duty when it is checked, else the certainty. */
export type AnswerKey = Obligation | "not_sure" | "outside_scope" | "disagree";

export function answerKey(result: AnalysisResult): AnswerKey {
  if (result.certainty === "checked") return result.engine.obligation ?? "not_sure";
  return result.certainty;
}

export function answerChange(before: AnalysisResult, after: AnalysisResult): { changed: false } | { changed: true; before: AnswerKey; after: AnswerKey } {
  const from = answerKey(before);
  const to = answerKey(after);
  return from === to ? { changed: false } : { changed: true, before: from, after: to };
}

export type ThreadReply =
  | { kind: "answer"; chip: WhatIfChip; imageSrc: string; result: AnalysisResult }
  | { kind: "confirm"; chip: WhatIfChip }
  | { kind: "not_possible"; cause: NotOfferedCause }
  | { kind: "not_on_example" }
  | { kind: "none" }
  | { kind: "not_applied"; refunded: boolean | null }
  | { kind: "paused" }
  | { kind: "limited"; message: string }
  | { kind: "error"; error: AnalysisError | null };

/** One question in the thread: the learner's words, how RoadSense read them, and its reply (null while it works). */
export interface ThreadEntry {
  id: number;
  words: string;
  readAs: WhatIfLabelKey | null;
  reply: ThreadReply | null;
}

export interface ThreadState {
  /** Bumped when another scene or photo opens, so replies to the old one are dropped. */
  generation: number;
  entries: ThreadEntry[];
  /** The entry whose photo is on screen, or null for the original. */
  selectedId: number | null;
  nextId: number;
}

export type ThreadAction =
  | { type: "reset" }
  | { type: "submit"; words: string }
  | { type: "select"; id: number | null }
  | { type: "read"; generation: number; id: number; readAs: WhatIfLabelKey | null }
  | { type: "reply"; generation: number; id: number; reply: ThreadReply }
  | { type: "run"; generation: number; id: number };

export const EMPTY_THREAD: ThreadState = { generation: 0, entries: [], selectedId: null, nextId: 1 };

/** Whether a question is still being worked on: the box and the chips wait for it. */
export function threadBusy(state: ThreadState): boolean {
  return state.entries.some((entry) => entry.reply === null);
}

export function threadReducer(state: ThreadState, action: ThreadAction): ThreadState {
  switch (action.type) {
    case "reset":
      return { ...state, generation: state.generation + 1, entries: [], selectedId: null };
    case "submit": {
      if (threadBusy(state)) return state;
      const entry: ThreadEntry = { id: state.nextId, words: action.words, readAs: null, reply: null };
      return { ...state, entries: [...state.entries, entry], selectedId: entry.id, nextId: state.nextId + 1 };
    }
    case "select":
      return { ...state, selectedId: action.id };
    case "read":
    case "reply":
    case "run": {
      if (action.generation !== state.generation) return state;
      const index = state.entries.findIndex((entry) => entry.id === action.id);
      if (index === -1) return state;
      const entry = state.entries[index];
      let next: ThreadEntry;
      if (action.type === "read") next = { ...entry, readAs: action.readAs };
      else if (action.type === "reply") next = { ...entry, reply: action.reply };
      else if (index === state.entries.length - 1 && entry.reply?.kind === "confirm") next = { ...entry, reply: null };
      else return state;
      return { ...state, entries: state.entries.map((current, i) => (i === index ? next : current)) };
    }
  }
}
