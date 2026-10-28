import { RoadsenseValidationError } from "./errors";
import type { MetaClient } from "./meta-client";
import { UNDERSTAND_SYSTEM, understandUserPrompt } from "./prompts";
import { UNDERSTAND_SCHEMA } from "./schemas";
import type { WhatIfMatch } from "./types";

// A learner's typed "What if…?" becomes one of the edits RoadSense can verify, or
// "none". The reply can only hold the schema's closed values, so whatever the words
// say they never reach an image prompt, and the page then checks the match against
// the photo's own facts (resolveTypedWhatIf in components/roadsense/view.ts).

/** The longest question the page and the route accept, in characters. */
export const MAX_WHATIF_TEXT = 200;

/** A model reply as a match: `to` is kept only with its own kind; any other shape is invalid. */
export function parseWhatIfMatch(json: unknown, costUsd = 0): WhatIfMatch {
  if (typeof json !== "object" || json === null) throw new RoadsenseValidationError("what-if match: not an object", costUsd);
  const { kind, to } = json as { kind?: unknown; to?: unknown };
  switch (kind) {
    case "swap_sign":
      return to === "stop" || to === "yield" ? { kind: "swap_sign", to } : { kind: "swap_sign" };
    case "set_light":
      return to === "red" || to === "green" ? { kind: "set_light", to } : { kind: "set_light" };
    case "remove_sign":
      return { kind: "remove_sign" };
    case "add_pedestrian_on_crossing":
      return { kind: "add_pedestrian_on_crossing" };
    case "add_emergency_vehicle":
      return { kind: "add_emergency_vehicle" };
    case "none":
      return { kind: "none" };
    default:
      throw new RoadsenseValidationError("what-if match: unknown kind", costUsd);
  }
}

/** Characters a learner's question never needs: markup, braces, and what closes the prompt's markers. */
const NOT_A_QUESTION = /[<>{}]/;

/**
 * One text-only Muse Spark call. An invalid reply gets one more try, then reads as none; both are
 * paid. Text with markup or braces reads as none without a call, so it can't forge a reply or
 * close the markers around the learner's words.
 */
export async function understandWhatIf(client: MetaClient, text: string): Promise<{ match: WhatIfMatch; costUsd: number }> {
  if (NOT_A_QUESTION.test(text)) return { match: { kind: "none" }, costUsd: 0 };
  let costUsd = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const reply = await client.chatJson({
        system: UNDERSTAND_SYSTEM,
        user: understandUserPrompt(text),
        schemaName: "what_if_match",
        schema: UNDERSTAND_SCHEMA,
      });
      return { match: parseWhatIfMatch(reply.json, reply.costUsd), costUsd: costUsd + reply.costUsd };
    } catch (err) {
      if (!(err instanceof RoadsenseValidationError)) throw err;
      costUsd += err.costUsd;
    }
  }
  return { match: { kind: "none" }, costUsd };
}
