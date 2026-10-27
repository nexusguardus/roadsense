import { decideObligation } from "./engine";
import type { Obligation, SceneFacts } from "./types";

const GIVING_WAY: ReadonlySet<Obligation> = new Set(["yield", "stop_and_yield", "yield_to_pedestrians", "yield_to_emergency_vehicle"]);
/** Citations that mean a sign, marking or light settled the junction. */
const SIGNED = ["rgc-56-1", "rgc-56-3"];

/**
 * The rules the model may cite for these facts, no model involved: every rule the
 * engine cites, plus how to give way (art. 58.1) and not blocking the junction
 * (art. 59.1) when the learner must give way, art. 59.1 on a green light (whose
 * meaning refers to it), and the priority-to-the-right rule (art. 57.1) when a
 * sign or light decided, so the model can explain why that tempting answer is wrong.
 */
export function retrieveRuleIds(facts: SceneFacts): string[] {
  const verdict = decideObligation(facts);
  const ids = [...verdict.ruleIds];
  if (verdict.status !== "decided" || verdict.obligation === null) return ids;
  if (GIVING_WAY.has(verdict.obligation)) ids.push("rgc-58-1", "rgc-59-1");
  if (verdict.ruleIds.includes("anexo-i-light-green")) ids.push("rgc-59-1");
  if (verdict.ruleIds.some((id) => SIGNED.includes(id))) ids.push("rgc-57-1");
  return [...new Set(ids)];
}
