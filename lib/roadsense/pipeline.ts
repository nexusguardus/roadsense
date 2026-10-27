import { rulesByIds } from "./corpus";
import { decideWithModel } from "./decide";
import { decideObligation } from "./engine";
import { RoadsenseValidationError } from "./errors";
import { confirmEvidence, confirmEvidenceDual } from "./evidence";
import { factById } from "./facts";
import { MODELS } from "./meta-client";
import type { MetaClient } from "./meta-client";
import { perceiveScene } from "./perceive";
import { retrieveRuleIds } from "./retrieve";
import type {
  AnalysisResult,
  Certainty,
  EngineVerdict,
  EvidenceCheck,
  ModelDecision,
  RoadsenseLocale,
  RuleRecord,
  SceneFacts,
} from "./types";
import { MIN_FACT_CONFIDENCE } from "./vocabulary";

// One analysis. Perception reads the photo into facts and the rule engine decides
// from the facts alone. The evidence check and the model's decision then run side
// by side, since neither needs the other's result. Only an answer they all agree
// on is "checked" (certaintyOf).

export type Stage = "perceive" | "check" | "confirm" | "retrieve" | "decide";

export interface PipelineDeps {
  client: MetaClient;
  corpus: RuleRecord[];
  evidenceMode: "sam" | "dual";
  /** The whole analysis budget, checked before each stage starts. */
  budgetMs: number;
  now?: () => number;
}

export class RoadsenseTimeoutError extends Error {
  constructor(stage: Stage, budgetMs: number) {
    super(`analysis ran past its ${budgetMs} ms budget before the ${stage} stage`);
    this.name = "RoadsenseTimeoutError";
  }
}

/**
 * The first matching rule wins; only "checked" earns the badge. A critical fact with no
 * evidence item counts as unconfirmed, and the model must cite at least one of the rules
 * the engine decided on (an empty citation list fails that too).
 */
export function certaintyOf(
  facts: SceneFacts,
  engine: EngineVerdict,
  model: ModelDecision | null,
  evidence: readonly EvidenceCheck[],
  retrievedIds: readonly string[],
): Certainty {
  if (engine.status === "out_of_scope") return "outside_scope";
  if (engine.status === "insufficient") return "not_sure";
  // The badge says SAM found what the answer depends on. An answer that rests only on what is
  // absent (no traffic) or on the scene as a whole (a roundabout, a dirt road) has nothing to confirm.
  if (engine.criticalFactIds.length === 0) return "not_sure";
  const confirmed = (id: string) => evidence.some((check) => check.factId === id && check.confirmed);
  if (evidence.some((check) => !check.confirmed) || !engine.criticalFactIds.every(confirmed)) return "not_sure";
  if (engine.criticalFactIds.some((id) => (factById(facts, id)?.confidence ?? 0) < MIN_FACT_CONFIDENCE)) return "not_sure";
  if (model === null) return "not_sure";
  if (model.obligation !== engine.obligation) return "disagree";
  const citesEngineRule = model.ruleIds.some((id) => engine.ruleIds.includes(id));
  if (!citesEngineRule || model.ruleIds.some((id) => !retrievedIds.includes(id))) return "disagree";
  return "checked";
}

/** A decision that fails validation is an answer we can't use, not an outage: it becomes "not sure". */
async function decideOrAbstain(
  client: MetaClient,
  facts: SceneFacts,
  rules: readonly RuleRecord[],
  locale: RoadsenseLocale,
): Promise<{ decision: ModelDecision | null; costUsd: number }> {
  try {
    return await decideWithModel(client, facts, rules, locale);
  } catch (err) {
    // The rejected reply was billed; the error carries its cost.
    if (err instanceof RoadsenseValidationError) return { decision: null, costUsd: err.costUsd };
    throw err;
  }
}

export async function analyzeScene(
  deps: PipelineDeps,
  input: { imageDataUrl: string; locale: RoadsenseLocale; facts?: SceneFacts },
  onStage?: (stage: Stage) => void,
): Promise<AnalysisResult> {
  const { client, corpus } = deps;
  const now = deps.now ?? Date.now;
  const start = now();
  const enter = (stage: Stage): void => {
    if (now() - start > deps.budgetMs) throw new RoadsenseTimeoutError(stage, deps.budgetMs);
    onStage?.(stage);
  };

  const perceive = async (): Promise<{ facts: SceneFacts; costUsd: number }> => {
    if (input.facts !== undefined) return { facts: input.facts, costUsd: 0 };
    enter("perceive");
    return perceiveScene(client, input.imageDataUrl);
  };
  const { facts, costUsd: perceptionCost } = await perceive();
  const perceptionModels = input.facts === undefined ? [client.sparkModel] : [];

  enter("check");
  const engine = decideObligation(facts);
  if (engine.status !== "decided") {
    return {
      certainty: certaintyOf(facts, engine, null, [], engine.ruleIds),
      facts,
      evidence: [],
      engine,
      model: null,
      rules: rulesByIds(corpus, engine.ruleIds),
      costUsd: perceptionCost,
      latencyMs: now() - start,
      modelIds: perceptionModels,
    };
  }

  // All three budget checks come before either call starts, so a timeout never leaves one running.
  enter("confirm");
  enter("retrieve");
  const retrievedIds = [...new Set([...retrieveRuleIds(facts), ...engine.ruleIds])];
  const rules = rulesByIds(corpus, retrievedIds);
  enter("decide");
  // Both calls finish before any failure surfaces: the caller reads the spend then, and a call still
  // running would be billed but never counted.
  const [checkedOutcome, decidedOutcome] = await Promise.allSettled([
    deps.evidenceMode === "sam"
      ? confirmEvidence(client, input.imageDataUrl, facts, engine.criticalFactIds)
      : confirmEvidenceDual(client, input.imageDataUrl, facts, engine.criticalFactIds),
    decideOrAbstain(client, facts, rules, input.locale),
  ]);
  if (checkedOutcome.status === "rejected") throw checkedOutcome.reason;
  if (decidedOutcome.status === "rejected") throw decidedOutcome.reason;
  const checked = checkedOutcome.value;
  const decided = decidedOutcome.value;
  const samUsed = deps.evidenceMode === "sam" && engine.criticalFactIds.length > 0;
  return {
    certainty: certaintyOf(facts, engine, decided.decision, checked.evidence, retrievedIds),
    facts,
    evidence: checked.evidence,
    engine,
    model: decided.decision,
    rules,
    costUsd: perceptionCost + checked.costUsd + decided.costUsd,
    latencyMs: now() - start,
    modelIds: [...new Set([...perceptionModels, ...(samUsed ? [MODELS.sam] : []), client.sparkModel])],
  };
}
