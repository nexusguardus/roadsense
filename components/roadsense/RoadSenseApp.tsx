"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RoadsenseCopy } from "./copy-table";
import type { AnalysisResult, RoadsenseLocale as Locale } from "../../lib/roadsense/types";
import { editKey, proposeEdits } from "../../lib/roadsense/edits";
import EvidenceImage from "./EvidenceImage";
import Hero, { HowItChecks, Steps, type HeroExample } from "./Hero";
import ResultCard from "./ResultCard";
import ScenePicker, { type SceneSummary } from "./ScenePicker";
import UploadPanel from "./UploadPanel";
import WhatIfBox from "./WhatIfBox";
import WhatIfThread from "./WhatIfThread";
import { resizeImage } from "./resizeImage";
import { useAnalysisStream, type AnalysisError } from "./useAnalysisStream";
import { outcomeOf, useWhatIfThread, type ThreadSubject } from "./useWhatIfThread";
import { evidenceOverlays, type WhatIfChip } from "./view";

interface RoadSenseAppProps {
  copy: RoadsenseCopy;
  locale: Locale;
  scenes: SceneSummary[];
  /** The answer the first screen shows as an example; null when its scene isn't available. */
  hero: HeroExample | null;
  /** The evaluation figures for the badge's explanation. */
  evaluation: string;
  cta: ReactNode;
  practiceHref: string;
  onEvent: (name: string, params?: Record<string, unknown>) => void;
}

/** What the workspace shows: a curated scene or the learner's photo, with its first answer once it has one. */
type View = { kind: "scene"; scene: SceneSummary; result: AnalysisResult | null } | { kind: "upload"; photo: string; result: AnalysisResult | null };

/**
 * The /roadsense page: the hero, then a workspace that appears once the learner picks an example
 * or a photo (the photo and its outlines, the answer, the what-if thread and box), the examples,
 * and how RoadSense checks itself. Nothing loads until the learner acts.
 */
export default function RoadSenseApp({ copy, locale, scenes, hero, evaluation, cta, practiceHref, onEvent }: RoadSenseAppProps) {
  const { state, run, reset } = useAnalysisStream();
  const whatIfs = useWhatIfThread({ locale, run, onEvent });
  const [view, setView] = useState<View | null>(null);
  /** A photo the learner picked, waiting for "Analyse this photo". */
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** Bumped whenever something opens in the workspace, which then scrolls into view. */
  const [opened, setOpened] = useState(0);
  // Answers already on this page, so going back to a scene is instant and free.
  const sceneCache = useRef(new Map<string, AnalysisResult>());
  const workspaceRef = useRef<HTMLDivElement>(null);
  const examplesRef = useRef<HTMLDivElement>(null);
  const whatIfInputRef = useRef<HTMLInputElement>(null);
  const busy = state.status === "running";
  // The learner's photo is being analysed and already counted: leaving it now would waste it.
  const locked = busy && view?.kind === "upload" && view.result === null;

  useEffect(() => {
    onEvent("roadsense_view", { scenes: scenes.length });
    // Runs once: the scene list comes from the server and doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // An instant jump: a smooth scroll of the page didn't run in every browser tested.
    if (opened > 0) workspaceRef.current?.scrollIntoView({ block: "start" });
  }, [opened]);

  const errorText = (failure: AnalysisError): string => {
    if ("message" in failure) return failure.message;
    if (failure.refunded === undefined) return copy.errors[failure.code];
    return `${copy.errors[failure.code]} ${failure.refunded ? copy.errors.refunded : copy.errors.counted}`;
  };

  async function openScene(scene: SceneSummary, track: boolean) {
    setError(null);
    setPending(null);
    setUploadError(null);
    whatIfs.reset();
    setOpened((count) => count + 1);
    const cached = sceneCache.current.get(scene.id);
    if (cached) {
      reset();
      setView({ kind: "scene", scene, result: cached });
      return;
    }
    setView({ kind: "scene", scene, result: null });
    const finished = await run("/api/roadsense/analyze", { sceneId: scene.id, locale });
    if (!finished) return;
    if (track) onEvent("roadsense_analyze", { source: "scene", scene_id: scene.id, outcome: outcomeOf(finished) });
    if (finished.status === "done" && finished.outcome.result) {
      sceneCache.current.set(scene.id, finished.outcome.result);
      setView({ kind: "scene", scene, result: finished.outcome.result });
      return;
    }
    setError(finished.status === "error" ? errorText(finished.error) : copy.errors.internal);
  }

  async function chooseFile(file: File) {
    setUploadError(null);
    try {
      const { dataUrl } = await resizeImage(file);
      reset();
      whatIfs.reset();
      setError(null);
      setView(null);
      setPending(dataUrl);
      setOpened((count) => count + 1);
    } catch {
      setUploadError(copy.errors.unreadable);
    }
  }

  async function analyseUpload() {
    if (!pending) return;
    const photo = pending;
    setPending(null);
    setError(null);
    whatIfs.reset();
    setView({ kind: "upload", photo, result: null });
    const finished = await run("/api/roadsense/analyze", { imageBase64: photo, locale });
    if (!finished) return;
    onEvent("roadsense_analyze", { source: "upload", outcome: outcomeOf(finished) });
    if (finished.status === "done" && finished.outcome.result) {
      setView({ kind: "upload", photo, result: finished.outcome.result });
      return;
    }
    setError(finished.status === "error" ? errorText(finished.error) : copy.errors.internal);
  }

  const subject: ThreadSubject | null = !view?.result
    ? null
    : view.kind === "scene"
      ? { kind: "scene", scene: view.scene, base: view.result }
      : { kind: "upload", photo: view.photo, base: view.result };
  const chips: WhatIfChip[] = !subject
    ? []
    : subject.kind === "scene"
      ? subject.scene.whatIfs
      : proposeEdits(subject.base.facts).map((edit) => ({ key: editKey(edit), edit }));
  // The photo on screen: the chosen what-if's edited photo, or the original.
  const chosen = whatIfs.thread.entries.find((entry) => entry.id === whatIfs.thread.selectedId)?.reply;
  const shown = chosen?.kind === "answer" ? chosen : null;
  const imageSrc = pending ?? shown?.imageSrc ?? (view?.kind === "scene" ? view.scene.imagePath : view?.photo);
  const overlays = pending ? [] : shown ? evidenceOverlays(shown.result) : view?.result ? evidenceOverlays(view.result) : [];
  const tag = pending ? null : shown ? copy.whatIf.edited : view?.kind === "scene" ? copy.scenes.aiGenerated : null;
  const alt = shown ? copy.whatIf.edited : view?.kind === "scene" ? view.scene.title : copy.upload.heading;
  const stage = state.status === "running" && state.stage ? copy.stages[state.stage] : null;

  return (
    <div className="space-y-12">
      <Hero
        copy={copy}
        locale={locale}
        example={hero}
        disabled={locked}
        error={pending ? null : uploadError}
        onUploadClick={() => onEvent("roadsense_cta", { target: "hero_upload" })}
        onFile={(file) => void chooseFile(file)}
        onTryExample={() => {
          onEvent("roadsense_cta", { target: "hero_example" });
          examplesRef.current?.scrollIntoView({ block: "start" });
        }}
        onOpenExample={(scene) => {
          onEvent("roadsense_cta", { target: "hero_example" });
          void openScene(scene, true);
        }}
      />

      <Steps copy={copy} />

      {(view || pending) && (
        <div ref={workspaceRef} className="grid scroll-mt-24 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            {imageSrc ? (
              <EvidenceImage src={imageSrc} alt={alt} tag={tag} overlays={overlays} busy={busy && !pending} />
            ) : (
              <div className="aspect-[3/2] rounded-2xl border border-outline-variant/60 bg-surface-container-lowest motion-safe:animate-pulse" aria-hidden="true" />
            )}
          </div>

          <div className="space-y-4">
            {pending ? (
              <UploadPanel copy={copy} busy={busy} error={uploadError} onFile={(file) => void chooseFile(file)} onAnalyse={() => void analyseUpload()} />
            ) : (
              <>
                {busy && !view?.result && (
                  <p role="status" className="flex items-center gap-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low p-4 text-sm font-medium text-on-surface">
                    <span className="h-4 w-4 shrink-0 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
                    {stage ?? copy.result.loading}
                  </p>
                )}
                {error && (
                  <p role="alert" className="rounded-xl border border-error/40 bg-error-container/30 p-4 text-sm text-on-error-container">
                    {error}
                  </p>
                )}
                {view?.result && (
                  <ResultCard
                    copy={copy}
                    locale={locale}
                    result={view.result}
                    evaluation={evaluation}
                    cta={cta}
                    practiceHref={practiceHref}
                    onPractice={() => onEvent("roadsense_cta", { target: "practice" })}
                  />
                )}
                {subject && (
                  <WhatIfThread
                    copy={copy}
                    locale={locale}
                    evaluation={evaluation}
                    thread={whatIfs.thread}
                    base={subject.base}
                    originalLabel={subject.kind === "scene" ? copy.whatIf.original : copy.whatIf.yourPhoto}
                    stage={stage}
                    errorText={errorText}
                    onSelect={whatIfs.select}
                    onRun={(id, fromKeyboard) => {
                      // Run it disappears once pressed: from the keyboard, focus goes back to the box, not the page.
                      // Not after a tap, where focusing a text box would open a phone's keyboard over the answer.
                      if (fromKeyboard) whatIfInputRef.current?.focus();
                      void whatIfs.confirm(subject, id);
                    }}
                    chips={chips}
                    disabled={busy || whatIfs.busy}
                    onChoose={(chip, words, fromKeyboard) => {
                      // A suggestion disappears once chosen: from the keyboard, focus goes back to the box.
                      if (fromKeyboard) whatIfInputRef.current?.focus();
                      void whatIfs.choose(subject, chip, words);
                    }}
                  />
                )}
                {subject && subject.base.certainty !== "outside_scope" && (
                  <WhatIfBox
                    copy={copy}
                    chips={chips}
                    live={subject.kind === "upload"}
                    disabled={busy || whatIfs.busy}
                    inputRef={whatIfInputRef}
                    onAsk={(words) => void whatIfs.ask(subject, words)}
                    onChoose={(chip, words) => void whatIfs.choose(subject, chip, words)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div ref={examplesRef} className="scroll-mt-24">
        <ScenePicker
          copy={copy}
          scenes={scenes}
          selectedId={view?.kind === "scene" ? view.scene.id : null}
          disabled={locked}
          onSelect={(scene) => void openScene(scene, true)}
        />
      </div>

      <HowItChecks copy={copy} evaluation={evaluation} onSource={() => onEvent("roadsense_cta", { target: "source_code" })} />
    </div>
  );
}
