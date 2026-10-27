import { RoadsenseValidationError } from "./errors";
import { factById, parseBox } from "./facts";
import type { MetaClient } from "./meta-client";
import { VERIFY_SYSTEM, verifyUserPrompt } from "./prompts";
import { areaRatio, overlapOverSmaller, parseSamOutput, samConceptFor, toGridBox } from "./sam";
import { VERIFY_SCHEMA } from "./schemas";
import type { Approach, Box, EvidenceCheck, SceneFact, SceneFacts } from "./types";

// A critical fact counts as confirmed only when a second, independent look (SAM 3.1,
// or a second Muse Spark pass in dual mode) finds the same kind of object in the
// same place. An unconfirmed fact makes the answer "not sure" (Task 8).

const MAX_CONCEPTS = 5;
/**
 * Overlap over the smaller box, not IoU: Muse Spark's boxes run a little offset (Task 1 notes).
 * 0.4 because correct signs and markings measured 0.45 and 0.49 in the evaluation (Task 14).
 */
const MIN_OVERLAP = 0.4;
/** Overlap over the smaller box is 1 for any box inside a bigger one, so the two must also be of comparable size. */
const MIN_AREA_RATIO = 0.25;
/** A detection SAM itself scores lower confirms nothing; the recorded scenes never went below 0.504. */
const MIN_SAM_CONFIDENCE = 0.5;

interface Match {
  box: Box | null;
  overlap: number;
}

/** The candidate of comparable size that overlaps the fact's box most. */
function bestMatch(factBox: Box, candidates: readonly Box[]): Match {
  return candidates
    .filter((candidate) => areaRatio(factBox, candidate) >= MIN_AREA_RATIO)
    .reduce<Match>(
      (best, candidate) => {
        const overlap = overlapOverSmaller(factBox, candidate);
        return overlap > best.overlap ? { box: candidate, overlap } : best;
      },
      { box: null, overlap: 0 },
    );
}

function evidenceFor(fact: SceneFact, concept: string, match: Match, minOverlap: number): EvidenceCheck {
  const confirmed = match.box !== null && match.overlap >= minOverlap;
  return { factId: fact.id, concept, confirmed, factBox: fact.box, matchedBox: confirmed ? match.box : null, overlap: match.overlap };
}

/** The critical facts, once each, in the engine's order. The engine only names facts perception reported. */
function criticalFacts(facts: SceneFacts, ids: readonly string[]): SceneFact[] {
  return [...new Set(ids)].map((id) => {
    const fact = factById(facts, id);
    if (fact === undefined) throw new RoadsenseValidationError(`critical fact ${id} is not among the scene facts`);
    return fact;
  });
}

/**
 * One SAM call per distinct concept among the critical facts, in the engine's order and at most
 * maxConcepts of them, run in parallel. Facts whose concept was not asked stay unconfirmed.
 */
export async function confirmEvidence(
  client: MetaClient,
  imageDataUrl: string,
  facts: SceneFacts,
  criticalFactIds: readonly string[],
  opts: { maxConcepts?: number; minOverlap?: number } = {},
): Promise<{ evidence: EvidenceCheck[]; costUsd: number }> {
  const minOverlap = opts.minOverlap ?? MIN_OVERLAP;
  const critical = criticalFacts(facts, criticalFactIds);
  const concepts = [...new Set(critical.map(samConceptFor))].slice(0, opts.maxConcepts ?? MAX_CONCEPTS);
  const answers = await Promise.all(concepts.map((concept) => client.segment({ imageDataUrl, concept })));
  const trusted = (text: string) => parseSamOutput(text).filter((d) => d.confidence === null || d.confidence >= MIN_SAM_CONFIDENCE);
  const detections = new Map(concepts.map((concept, i) => [concept, trusted(answers[i].text).map(toGridBox)]));
  const evidence = critical.map((fact) => {
    const concept = samConceptFor(fact);
    return evidenceFor(fact, concept, bestMatch(fact.box, detections.get(concept) ?? []), minOverlap);
  });
  return { evidence, costUsd: answers.reduce((sum, answer) => sum + answer.costUsd, 0) };
}

interface FactCheck {
  factId: string;
  present: boolean;
  box: Box | null;
}

function parseChecks(data: unknown): FactCheck[] {
  const checks = (data as { checks?: unknown } | null)?.checks;
  if (!Array.isArray(checks)) throw new RoadsenseValidationError("fact checks: checks must be an array");
  return checks.map((item: unknown, i) => {
    const raw = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    if (typeof raw.factId !== "string" || typeof raw.present !== "boolean") {
      throw new RoadsenseValidationError(`fact checks[${i}]: needs a factId and present`);
    }
    return { factId: raw.factId, present: raw.present, box: raw.box == null ? null : parseBox(raw.box, `checks[${i}].box`) };
  });
}

const APPROACH_WORDS: Record<Approach, string> = {
  ego: "for the learner's own approach",
  left: "for traffic coming from the left",
  right: "for traffic coming from the right",
  ahead: "for traffic coming from ahead",
};

/** What was reported, without where: the second look has to find it on its own. */
function describe(fact: SceneFact): string {
  if ("position" in fact) return `${samConceptFor(fact)} (${fact.position.replace(/_/g, " ")})`;
  const detail = "state" in fact ? fact.state : fact.kind;
  return `${samConceptFor(fact)} (${detail.replace(/_/g, " ")}, ${APPROACH_WORDS[fact.appliesTo]})`;
}

/** The fallback when SAM is unusable: a second Muse Spark pass over the full image (there is no image library to crop with). */
export async function confirmEvidenceDual(
  client: MetaClient,
  imageDataUrl: string,
  facts: SceneFacts,
  criticalFactIds: readonly string[],
): Promise<{ evidence: EvidenceCheck[]; costUsd: number }> {
  const critical = criticalFacts(facts, criticalFactIds);
  if (critical.length === 0) return { evidence: [], costUsd: 0 };
  const { json, costUsd } = await client.chatJson({
    system: VERIFY_SYSTEM,
    user: verifyUserPrompt(critical.map((fact) => ({ id: fact.id, what: describe(fact) }))),
    imageDataUrl,
    schemaName: "fact_checks",
    schema: VERIFY_SCHEMA,
  });
  const checks = parseChecks(json);
  const evidence = critical.map((fact) => {
    const found = checks.find((c) => c.factId === fact.id && c.present)?.box;
    return evidenceFor(fact, samConceptFor(fact), bestMatch(fact.box, found ? [found] : []), MIN_OVERLAP);
  });
  return { evidence, costUsd };
}
