"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RoadsenseCopy } from "./copy-table";
import type { RoadsenseLocale as Locale } from "../../lib/roadsense/types";
import { editKey, proposeEdits } from "../../lib/roadsense/edits";
import type { AnalysisResult } from "../../lib/roadsense/types";
import EvidenceImage from "./EvidenceImage";
import ResultCard from "./ResultCard";
import ScenePicker, { type SceneSummary } from "./ScenePicker";
import UploadPanel from "./UploadPanel";
import WhatIfBar, { type WhatIfChip } from "./WhatIfBar";
import { resizeImage } from "./resizeImage";
import { useAnalysisStream, type AnalysisError, type AnalysisState } from "./useAnalysisStream";
import { evidenceOverlays } from "./view";

interface RoadSenseAppProps {
  copy: RoadsenseCopy;
  locale: Locale;
  scenes: SceneSummary[];
  /** The scene on screen when the page opens. */
  featuredId: string | null;
  /** The evaluation figures for the badge's explanation. */
  evaluation: string;
  cta: ReactNode;
  practiceHref: string;
  onEvent: (name: string, params?: Record<string, unknown>) => void;
}

/** What the viewer shows: a curated scene or the learner's photo, original or edited. */
type View =
  | { kind: "scene"; scene: SceneSummary; whatIfKey: string | null; imageSrc: string; result: AnalysisResult | null }
  | { kind: "upload"; whatIfKey: string | null; imageSrc: string; result: AnalysisResult | null };

type Finished = Extract<AnalysisState, { status: "done" | "error" }>;

/** The analytics outcome of a request: the certainty, or why there is none. */
function outcomeOf(finished: Finished): string {
  if (finished.status === "error") return "code" in finished.error ? finished.error.code : "refused";
  if (finished.outcome.applied === false) return "not_applied";
  return finished.outcome.result?.certainty ?? "none";
}

export default function RoadSenseApp({ copy, locale, scenes, featuredId, evaluation, cta, practiceHref, onEvent }: RoadSenseAppProps) {
  const { state, run, reset } = useAnalysisStream();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<{ photo: string; result: AnalysisResult } | null>(null);
  // Answers already on this page, so going back to one is instant and free.
  const sceneCache = useRef(new Map<string, { imageSrc: string; result: AnalysisResult }>());
  const uploadCache = useRef(new Map<string, { imageSrc: string; result: AnalysisResult }>());
  const viewerRef = useRef<HTMLDivElement>(null);
  const busy = state.status === "running";

  const errorText = (failure: AnalysisError): string => {
    if ("message" in failure) return failure.message;
    if (failure.refunded === undefined) return copy.errors[failure.code];
    return `${copy.errors[failure.code]} ${failure.refunded ? copy.errors.refunded : copy.errors.counted}`;
  };

  /** Brings the viewer back into view when the learner acted further down the page. */
  function scrollToViewer() {
    const viewer = viewerRef.current;
    if (!viewer || viewer.getBoundingClientRect().top >= 0) return;
    // An instant jump: a smooth scroll of the page didn't run in every browser tested.
    viewer.scrollIntoView({ block: "start" });
  }

  async function openScene(scene: SceneSummary, whatIf: WhatIfChip | null, track: boolean) {
    setError(null);
    setNotice(null);
    const whatIfKey = whatIf?.key ?? null;
    const cacheKey = `${scene.id}|${whatIfKey ?? ""}`;
    const cached = sceneCache.current.get(cacheKey);
    if (cached) {
      reset();
      setView({ kind: "scene", scene, whatIfKey, ...cached });
      return;
    }
    // While an edit loads, the scene stays on screen; its own photo is known at once.
    setView((previous) => ({
      kind: "scene",
      scene,
      whatIfKey,
      imageSrc: whatIf && previous?.kind === "scene" && previous.scene.id === scene.id ? previous.imageSrc : scene.imagePath,
      result: null,
    }));
    const finished = whatIf
      ? await run("/api/roadsense/whatif", { sceneId: scene.id, editKey: whatIf.key, locale })
      : await run("/api/roadsense/analyze", { sceneId: scene.id, locale });
    if (!finished) return;
    if (track) onEvent(whatIf ? "roadsense_whatif" : "roadsense_analyze", { source: "scene", scene_id: scene.id, kind: whatIf?.edit.kind, outcome: outcomeOf(finished) });
    if (finished.status === "done" && finished.outcome.result) {
      const shown = { imageSrc: whatIf ? (finished.outcome.imagePath ?? scene.imagePath) : scene.imagePath, result: finished.outcome.result };
      sceneCache.current.set(cacheKey, shown);
      setView({ kind: "scene", scene, whatIfKey, ...shown });
      return;
    }
    setError(finished.status === "error" ? errorText(finished.error) : copy.errors.internal);
    const original = sceneCache.current.get(`${scene.id}|`);
    if (whatIf && original) setView({ kind: "scene", scene, whatIfKey: null, ...original });
  }

  async function chooseFile(file: File) {
    setUploadError(null);
    try {
      const { dataUrl } = await resizeImage(file);
      setPreview(dataUrl);
    } catch {
      setPreview(null);
      setUploadError(copy.errors.unreadable);
    }
  }

  async function analyseUpload() {
    if (!preview) return;
    const photo = preview;
    setError(null);
    setNotice(null);
    setUploaded(null);
    uploadCache.current.clear();
    setView({ kind: "upload", whatIfKey: null, imageSrc: photo, result: null });
    scrollToViewer();
    const finished = await run("/api/roadsense/analyze", { imageBase64: photo, locale });
    if (!finished) return;
    onEvent("roadsense_analyze", { source: "upload", outcome: outcomeOf(finished) });
    if (finished.status === "done" && finished.outcome.result) {
      setUploaded({ photo, result: finished.outcome.result });
      setView({ kind: "upload", whatIfKey: null, imageSrc: photo, result: finished.outcome.result });
      return;
    }
    setError(finished.status === "error" ? errorText(finished.error) : copy.errors.internal);
  }

  async function editUpload(chip: WhatIfChip | null) {
    if (!uploaded) return;
    setError(null);
    setNotice(null);
    const original: View = { kind: "upload", whatIfKey: null, imageSrc: uploaded.photo, result: uploaded.result };
    const cached = chip ? uploadCache.current.get(chip.key) : undefined;
    if (!chip || cached) {
      reset();
      setView(chip && cached ? { kind: "upload", whatIfKey: chip.key, ...cached } : original);
      return;
    }
    setView((previous) => ({ kind: "upload", whatIfKey: chip.key, imageSrc: previous?.imageSrc ?? uploaded.photo, result: null }));
    // The server reads the photo again and runs only the edit of this kind that it offers.
    const finished = await run("/api/roadsense/whatif", { imageBase64: uploaded.photo, edit: { kind: chip.edit.kind }, locale });
    if (!finished) return;
    onEvent("roadsense_whatif", { source: "upload", kind: chip.edit.kind, outcome: outcomeOf(finished) });
    const { applied, imageDataUrl, result } = finished.status === "done" ? finished.outcome : { applied: false, imageDataUrl: null, result: null };
    if (applied && imageDataUrl && result) {
      uploadCache.current.set(chip.key, { imageSrc: imageDataUrl, result });
      setView({ kind: "upload", whatIfKey: chip.key, imageSrc: imageDataUrl, result });
      return;
    }
    setView(original);
    if (finished.status === "error") setError(errorText(finished.error));
    else setNotice(copy.whatIf.notApplied);
  }

  // The featured scene is on screen from the start; opening it is not a learner's choice, so it isn't tracked.
  useEffect(() => {
    onEvent("roadsense_view", { scenes: scenes.length });
    const featured = scenes.find((scene) => scene.id === featuredId) ?? scenes[0];
    if (featured) void openScene(featured, null, false);
    // Runs once: the scene list and featured scene come from the server and don't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chips: WhatIfChip[] =
    view?.kind === "scene"
      ? view.scene.whatIfs
      : uploaded && uploaded.result.certainty !== "outside_scope"
        ? proposeEdits(uploaded.result.facts).map((edit) => ({ key: editKey(edit), edit }))
        : [];
  // Labelled by the photo on screen: while an edit loads, the photo before it stays up.
  const edited =
    view?.kind === "scene" ? view.imageSrc !== view.scene.imagePath : view?.kind === "upload" && uploaded !== null && view.imageSrc !== uploaded.photo;
  const tag = edited ? copy.whatIf.edited : view?.kind === "scene" ? copy.scenes.aiGenerated : null;
  const alt = edited ? copy.whatIf.edited : view?.kind === "scene" ? view.scene.title : copy.upload.heading;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl space-y-3">
        <p className="font-label-caps text-label-caps uppercase tracking-widest text-primary-fixed-dim">{copy.page.name}</p>
        <h1 className="font-headline-xl text-3xl font-bold text-on-surface md:text-4xl">{copy.page.title}</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">{copy.page.lead}</p>
        <p className="text-xs text-on-surface-variant">{copy.page.poweredBy}</p>
      </header>

      <div ref={viewerRef} className="grid scroll-mt-24 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-24">
          {view ? (
            <EvidenceImage src={view.imageSrc} alt={alt} tag={tag} overlays={view.result ? evidenceOverlays(view.result) : []} busy={busy} />
          ) : (
            <div className="aspect-[3/2] rounded-2xl border border-outline-variant/60 bg-surface-container-lowest motion-safe:animate-pulse" aria-hidden="true" />
          )}
          <WhatIfBar
            copy={copy}
            chips={chips}
            activeKey={view?.whatIfKey ?? null}
            live={view?.kind === "upload"}
            disabled={busy || !view?.result}
            onSelect={(chip) => {
              if (view?.kind === "scene") void openScene(view.scene, chip, true);
              else void editUpload(chip);
            }}
          />
          {notice && (
            <p role="status" className="rounded-xl border border-outline-variant/60 bg-surface-container p-3 text-sm text-on-surface">
              {notice}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {busy && (
            <p role="status" className="flex items-center gap-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low p-4 text-sm font-medium text-on-surface">
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
              {state.status === "running" && state.stage ? copy.stages[state.stage] : copy.result.loading}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl border border-error/40 bg-error-container/30 p-4 text-sm text-on-error-container">
              {error}
            </p>
          )}
          {!busy && view?.result && (
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
        </div>
      </div>

      <ScenePicker
        copy={copy}
        scenes={scenes}
        selectedId={view?.kind === "scene" ? view.scene.id : null}
        disabled={busy && view?.kind === "upload"}
        onSelect={(scene) => {
          scrollToViewer();
          void openScene(scene, null, true);
        }}
      />

      <UploadPanel copy={copy} preview={preview} busy={busy} error={uploadError} onFile={(file) => void chooseFile(file)} onAnalyse={() => void analyseUpload()} />
    </div>
  );
}
