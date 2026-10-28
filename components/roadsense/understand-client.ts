import type { RoadsenseLocale, WhatIfMatch } from "../../lib/roadsense/types";
import { parseWhatIfMatch } from "../../lib/roadsense/understand";

// Asks /api/roadsense/whatif/understand to read a learner's typed what-if. It never throws:
// every failure becomes a reply the thread can show (lib/roadsense-host/live.ts sets the codes).

export type UnderstandReply = { ok: true; match: WhatIfMatch } | { ok: false; reason: "paused" | "limited" | "error"; message: string | null };

const UNDERSTAND_URL = "/api/roadsense/whatif/understand";

/** The match, or why there is none: paused (503), over a limit (429, with the server's message) or anything else. */
export async function askUnderstand(text: string, locale: RoadsenseLocale, fetchImpl: typeof fetch = fetch): Promise<UnderstandReply> {
  try {
    const response = await fetchImpl(UNDERSTAND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale }),
    });
    const body = (await response.json().catch(() => null)) as { match?: unknown; message?: unknown } | null;
    if (response.ok) return { ok: true, match: parseWhatIfMatch(body?.match) };
    if (response.status === 503) return { ok: false, reason: "paused", message: null };
    if (response.status === 429) return { ok: false, reason: "limited", message: typeof body?.message === "string" ? body.message : null };
    return { ok: false, reason: "error", message: null };
  } catch {
    // A network failure, or a match of the wrong shape.
    return { ok: false, reason: "error", message: null };
  }
}
