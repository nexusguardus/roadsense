import type { AnalysisResult, RoadsenseLocale as Locale } from "../../lib/roadsense/types";
import type { SceneSummary } from "./ScenePicker";
import type { UnderstandReply } from "./understand-client";
import type { AnalysisState } from "./useAnalysisStream";
import { matchLabelKey, resolveTypedWhatIf, threadBusy, whatIfLabelKey, type ThreadAction, type ThreadReply, type ThreadState, type WhatIfChip } from "./view";

// The what-if thread's requests, kept apart from React so they can be tested. A typed question is
// first read by the understand route, then resolved against the photo's facts: an example answers
// from its pre-generated what-ifs, while the learner's own photo asks "Run it?" first, since a live
// what-if counts as one analysis. Analytics get the match's kind and what happened, never the words.

type Finished = Extract<AnalysisState, { status: "done" | "error" }>;

/** The photo the questions are about, with its first answer. */
export type ThreadSubject =
  | { kind: "scene"; scene: SceneSummary; base: AnalysisResult }
  | { kind: "upload"; photo: string; base: AnalysisResult };

export interface ThreadActionDeps {
  locale: Locale;
  /** The thread as it is now, including dispatches made since the last render. */
  getState: () => ThreadState;
  dispatch: (action: ThreadAction) => void;
  /** The page's shared request slot (useAnalysisStream): starting a request cancels the one before. */
  run: (url: string, body: Record<string, unknown>) => Promise<Finished | null>;
  understand: (text: string, locale: Locale) => Promise<UnderstandReply>;
  onEvent: (name: string, params?: Record<string, unknown>) => void;
}

/** The analytics outcome of a request: the certainty, or why there is none. */
export function outcomeOf(finished: Finished): string {
  if (finished.status === "error") return "code" in finished.error ? finished.error.code : "refused";
  if (finished.outcome.applied === false) return "not_applied";
  return finished.outcome.result?.certainty ?? "none";
}

/** What roadsense_whatif_typed calls a reply. */
function resolutionOf(reply: ThreadReply): string {
  return reply.kind === "answer" || reply.kind === "confirm" ? "run" : reply.kind;
}

export function createThreadActions({ locale, getState, dispatch, run, understand, onEvent }: ThreadActionDeps) {
  /** Starts an entry unless one is still working, and returns its address. */
  function start(words: string): { generation: number; id: number } | null {
    const state = getState();
    if (threadBusy(state)) return null;
    dispatch({ type: "submit", words });
    return { generation: state.generation, id: state.nextId };
  }

  async function runChip(subject: ThreadSubject, chip: WhatIfChip): Promise<ThreadReply> {
    const edit = "to" in chip.edit ? { kind: chip.edit.kind, to: chip.edit.to } : { kind: chip.edit.kind };
    const body = subject.kind === "scene" ? { sceneId: subject.scene.id, editKey: chip.key, locale } : { imageBase64: subject.photo, edit, locale };
    const finished = await run("/api/roadsense/whatif", body);
    // Null: another photo opened meanwhile, and its reset already dropped this entry.
    if (!finished) return { kind: "error", error: null };
    onEvent("roadsense_whatif", { source: subject.kind, kind: chip.edit.kind, outcome: outcomeOf(finished) });
    if (finished.status === "error") return { kind: "error", error: finished.error };
    const { result, applied, imageDataUrl, imagePath, refunded } = finished.outcome;
    if (!result || applied === false) return { kind: "not_applied", refunded: refunded ?? null };
    const imageSrc = imageDataUrl ?? imagePath ?? (subject.kind === "scene" ? subject.scene.imagePath : subject.photo);
    return { kind: "answer", chip, imageSrc, result };
  }

  /** A typed question: read it, resolve it against the photo, then answer, ask to run it, or say why not. */
  async function ask(subject: ThreadSubject, words: string): Promise<void> {
    const at = start(words);
    if (!at) return;
    const understood = await understand(words, locale);
    // Another photo opened while the question was read: its reset dropped this entry, and a request
    // now would cancel that photo's own analysis in the shared slot.
    if (getState().generation !== at.generation) return;
    if (!understood.ok) {
      const reply: ThreadReply =
        understood.reason === "paused"
          ? { kind: "paused" }
          : understood.reason === "limited" && understood.message
            ? { kind: "limited", message: understood.message }
            : { kind: "error", error: null };
      dispatch({ type: "reply", ...at, reply });
      onEvent("roadsense_whatif_typed", { source: subject.kind, resolution: resolutionOf(reply) });
      return;
    }
    const { match } = understood;
    const resolution = resolveTypedWhatIf(match, subject.base.facts, subject.kind === "scene" ? subject.scene.whatIfs : null);
    dispatch({ type: "read", ...at, readAs: resolution.outcome === "run" ? whatIfLabelKey(resolution.chip.edit) : matchLabelKey(match) });
    let reply: ThreadReply;
    if (resolution.outcome === "run") reply = subject.kind === "scene" ? await runChip(subject, resolution.chip) : { kind: "confirm", chip: resolution.chip };
    else if (resolution.outcome === "not_possible") reply = { kind: "not_possible", cause: resolution.cause };
    else if (resolution.outcome === "not_on_example") reply = { kind: "not_on_example" };
    else reply = { kind: "none" };
    dispatch({ type: "reply", ...at, reply });
    onEvent("roadsense_whatif_typed", { source: subject.kind, match: match.kind, resolution: resolutionOf(reply) });
  }

  /** A suggestion chip: an edit the photo offers, so it runs at once, with no understanding step. */
  async function choose(subject: ThreadSubject, chip: WhatIfChip, words: string): Promise<void> {
    const at = start(words);
    if (!at) return;
    dispatch({ type: "read", ...at, readAs: whatIfLabelKey(chip.edit) });
    dispatch({ type: "reply", ...at, reply: await runChip(subject, chip) });
  }

  /** "Run it" on the newest entry: the live what-if on the learner's photo. */
  async function confirm(subject: ThreadSubject, id: number): Promise<void> {
    const state = getState();
    const entry = state.entries.at(-1);
    if (!entry || entry.id !== id || entry.reply?.kind !== "confirm") return;
    const { chip } = entry.reply;
    const at = { generation: state.generation, id };
    dispatch({ type: "run", ...at });
    dispatch({ type: "reply", ...at, reply: await runChip(subject, chip) });
  }

  return { ask, choose, confirm };
}
