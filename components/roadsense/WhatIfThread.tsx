"use client";

import type { AnalysisResult, RoadsenseLocale as Locale } from "../../lib/roadsense/types";
import type { RoadsenseCopy } from "./copy-table";
import EvidenceImage from "./EvidenceImage";
import Explained from "./Explained";
import ResultCard from "./ResultCard";
import type { AnalysisError } from "./useAnalysisStream";
import { answerChange, answerKey, evidenceOverlays, fillTemplate, type AnswerKey, type ThreadEntry, type ThreadState } from "./view";

interface WhatIfThreadProps {
  copy: RoadsenseCopy;
  locale: Locale;
  evaluation: string;
  thread: ThreadState;
  /** The photo's first answer, which each what-if is compared with. */
  base: AnalysisResult;
  /** "Your photo" or "Original example". */
  originalLabel: string;
  /** The stage of a live what-if while it runs. */
  stage: string | null;
  errorText: (error: AnalysisError) => string;
  onSelect: (id: number | null) => void;
  /** fromKeyboard: Run it was pressed with a key, whose click has detail 0 (a tap or a mouse click has 1). */
  onRun: (id: number, fromKeyboard: boolean) => void;
}

function answerLabel(copy: RoadsenseCopy, key: AnswerKey): string {
  return key === "not_sure" || key === "outside_scope" || key === "disagree" ? copy.certainty[key].label : copy.obligations[key];
}

const ROW = "text-sm leading-relaxed text-on-surface";

interface EntryProps extends Omit<WhatIfThreadProps, "thread" | "originalLabel"> {
  entry: ThreadEntry;
  selected: boolean;
  newest: boolean;
}

function Entry({ copy, locale, evaluation, base, stage, errorText, onSelect, onRun, entry, selected, newest }: EntryProps) {
  const { reply, readAs } = entry;
  const readAsText = readAs && (
    <>
      {copy.whatIf.readAs}{" "}
      <span className="font-semibold text-on-surface">
        <Explained text={copy.whatIf.readAsLabels[readAs]} locale={locale} />
      </span>
    </>
  );
  const notCounted = <p className="text-xs text-on-surface-variant">{copy.whatIf.notCounted}</p>;
  const change = reply?.kind === "answer" ? answerChange(base, reply.result) : null;
  const changeText = !change
    ? null
    : change.changed
      ? fillTemplate(copy.whatIf.before, { before: answerLabel(copy, change.before), after: answerLabel(copy, change.after) })
      : copy.whatIf.same;
  return (
    <li className="space-y-2" aria-current={selected ? "true" : undefined}>
      {/* ph-no-capture: the learner's own words never reach analytics, not even as a click's element text. */}
      <p className="ph-no-capture ms-auto w-fit max-w-[85%] rounded-2xl rounded-ee-md bg-primary px-3.5 py-2 text-sm text-on-primary">{entry.words}</p>
      <div className={`space-y-2.5 rounded-2xl rounded-es-md border bg-surface-container-low p-3 ${selected ? "border-primary/70" : "border-outline-variant/60"}`}>
        {readAsText &&
          (reply?.kind === "answer" ? (
            // An answer brings its own photo: choosing the entry puts it on screen.
            <button type="button" aria-pressed={selected} onClick={() => onSelect(entry.id)} className="text-start text-sm text-on-surface-variant hover:underline">
              {readAsText}
            </button>
          ) : (
            <p className="text-sm text-on-surface-variant">{readAsText}</p>
          ))}
        {reply === null && (
          <p role="status" className={`flex items-center gap-2 ${ROW}`}>
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
            {readAs ? (stage ?? copy.result.loading) : copy.stages.understand}
          </p>
        )}
        {reply?.kind === "answer" && (
          <>
            {/* Its own photo here too: the page's main photo scrolls out of view on long threads and on phones. */}
            <EvidenceImage src={reply.imageSrc} alt={copy.whatIf.edited} tag={copy.whatIf.edited} overlays={evidenceOverlays(reply.result)} busy={false} />
            <ResultCard copy={copy} locale={locale} result={reply.result} evaluation={evaluation} compact />
            {changeText && (
              <p className="text-sm text-on-surface-variant">
                <Explained text={changeText} locale={locale} />
              </p>
            )}
          </>
        )}
        {reply?.kind === "confirm" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className={ROW}>{copy.whatIf.confirm}</p>
            {newest && (
              <button type="button" onClick={(event) => onRun(entry.id, event.detail === 0)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary">
                {copy.whatIf.run}
              </button>
            )}
          </div>
        )}
        {reply?.kind === "not_possible" && (
          <>
            <p className={ROW}>
              <Explained text={copy.whatIf.notPossible[reply.cause]} locale={locale} />
            </p>
            {notCounted}
          </>
        )}
        {reply?.kind === "not_on_example" && (
          <>
            <p className={ROW}>{copy.whatIf.notOnExample}</p>
            {notCounted}
          </>
        )}
        {reply?.kind === "none" && (
          <>
            <p className={ROW}>{copy.whatIf.none}</p>
            {notCounted}
          </>
        )}
        {reply?.kind === "not_applied" && (
          <p className={ROW}>
            {copy.whatIf.notApplied}
            {reply.refunded === null ? "" : ` ${reply.refunded ? copy.errors.refunded : copy.errors.counted}`}
          </p>
        )}
        {reply?.kind === "paused" && <p className={ROW}>{copy.whatIf.paused}</p>}
        {reply?.kind === "limited" && <p className={ROW}>{reply.message}</p>}
        {reply?.kind === "error" && <p className={ROW}>{reply.error ? errorText(reply.error) : copy.whatIf.error}</p>}
      </div>
    </li>
  );
}

/** The learner's questions about this photo and RoadSense's replies, newest last. */
export default function WhatIfThread(props: WhatIfThreadProps) {
  const { copy, thread, base, originalLabel, onSelect } = props;
  if (thread.entries.length === 0) return null;
  const newestId = thread.entries[thread.entries.length - 1].id;
  return (
    <section className="space-y-3">
      <button
        type="button"
        aria-pressed={thread.selectedId === null}
        onClick={() => onSelect(null)}
        className={`flex w-full flex-wrap items-center gap-x-2 rounded-xl border px-3.5 py-2.5 text-start text-sm ${
          thread.selectedId === null ? "border-primary/70 bg-primary/10" : "border-outline-variant/60 bg-surface-container"
        }`}
      >
        <span className="text-on-surface-variant">{originalLabel}:</span>
        <span className="font-semibold text-on-surface">{answerLabel(copy, answerKey(base))}</span>
      </button>
      <ol aria-live="polite" className="space-y-4">
        {thread.entries.map((entry) => (
          <Entry key={entry.id} {...props} entry={entry} selected={thread.selectedId === entry.id} newest={entry.id === newestId} />
        ))}
      </ol>
    </section>
  );
}
