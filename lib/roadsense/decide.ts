import { RoadsenseValidationError } from "./errors";
import type { MetaClient } from "./meta-client";
import { DECISION_SYSTEM, decisionUserPrompt } from "./prompts";
import { decisionSchema } from "./schemas";
import type { ModelDecision, Obligation, RoadsenseLocale, RuleRecord, SceneFacts } from "./types";
import { OBLIGATIONS } from "./vocabulary";

function fail(message: string): never {
  throw new RoadsenseValidationError(`decision: ${message}`);
}

function text(value: unknown, key: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${key} must be a non-empty string`);
  return value;
}

function strings(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) fail(`${key} must be a list of strings`);
  return [...(value as string[])];
}

/** The model's decision, accepted only if it cites at least one of the rules it was given and nothing else. */
function parseDecision(data: unknown, allowedIds: readonly string[]): ModelDecision {
  if (typeof data !== "object" || data === null) fail("must be an object");
  const raw = data as Record<string, unknown>;
  if (!(OBLIGATIONS as readonly unknown[]).includes(raw.obligation)) fail("unknown obligation");
  const ruleIds = strings(raw.ruleIds, "ruleIds");
  if (ruleIds.length === 0) fail("must cite at least one rule");
  const stray = ruleIds.find((id) => !allowedIds.includes(id));
  if (stray !== undefined) fail(`cites ${stray}, which it was not given`);
  return {
    obligation: raw.obligation as Obligation,
    priorityTo: strings(raw.priorityTo, "priorityTo"),
    rationale: text(raw.rationale, "rationale"),
    temptingWrongAnswer: text(raw.temptingWrongAnswer, "temptingWrongAnswer"),
    whyWrong: text(raw.whyWrong, "whyWrong"),
    ruleIds,
  };
}

/** Muse Spark decides from the facts and the retrieved excerpts only, explaining in the learner's language. */
export async function decideWithModel(
  client: MetaClient,
  facts: SceneFacts,
  rules: readonly RuleRecord[],
  locale: RoadsenseLocale,
): Promise<{ decision: ModelDecision; costUsd: number }> {
  const ids = rules.map((rule) => rule.id);
  const { json, costUsd } = await client.chatJson({
    system: DECISION_SYSTEM,
    user: decisionUserPrompt(facts, rules, locale),
    schemaName: "decision",
    schema: decisionSchema(ids),
  });
  try {
    return { decision: parseDecision(json, ids), costUsd };
  } catch (err) {
    // The reply was billed even though it is unusable; the caller still counts it.
    if (err instanceof RoadsenseValidationError) throw new RoadsenseValidationError(err.message, costUsd);
    throw err;
  }
}
