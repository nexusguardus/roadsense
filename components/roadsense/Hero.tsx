"use client";

import { useRef } from "react";
import type { AnalysisResult, RoadsenseLocale as Locale } from "../../lib/roadsense/types";
import type { RoadsenseCopy } from "./copy-table";
import EvidenceImage from "./EvidenceImage";
import Explained from "./Explained";
import type { SceneSummary } from "./ScenePicker";
import { evidenceOverlays, fillTemplate, rulesToShow } from "./view";

/** One answer on the first screen, so the page shows what it does before anything loads. */
export interface HeroExample {
  scene: SceneSummary;
  result: AnalysisResult;
}

interface HeroProps {
  copy: RoadsenseCopy;
  locale: Locale;
  example: HeroExample | null;
  /** True while the learner's photo is being analysed: picking another would waste an analysis already counted. */
  disabled: boolean;
  /** A photo that couldn't be read, shown under the button. */
  error: string | null;
  onUploadClick: () => void;
  onFile: (file: File) => void;
  onTryExample: () => void;
  onOpenExample: (scene: SceneSummary) => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp";
const SOURCE_URL = "https://github.com/nexusguardus/roadsense";

function ExampleCard({ copy, locale, example, disabled, onOpen }: { copy: RoadsenseCopy; locale: Locale; example: HeroExample; disabled: boolean; onOpen: () => void }) {
  const { scene, result } = example;
  const rule = rulesToShow(result)[0];
  const checked = result.certainty === "checked" && result.engine.obligation !== null;
  const verdict = checked && result.engine.obligation ? copy.obligations[result.engine.obligation] : copy.certainty[result.certainty].label;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-label={`${copy.hero.exampleTag}: ${scene.title}. ${verdict}`}
      className="group relative block w-full rounded-2xl text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed"
    >
      <EvidenceImage src={scene.imagePath} alt="" tag={copy.hero.exampleTag} overlays={evidenceOverlays(result)} busy={false} />
      <span className="absolute inset-x-3 bottom-3 block rounded-xl border border-outline-variant/60 bg-surface-container-lowest/90 p-3 backdrop-blur transition-colors group-hover:border-primary/60">
        <span className="block font-headline-xl text-lg font-bold leading-snug text-on-surface">
          <Explained text={verdict} locale={locale} />
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-on-surface-variant">
          {checked && (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/50 bg-success-container px-2 py-0.5 font-bold text-on-success-container">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                check_circle
              </span>
              {copy.certainty.checked.label}
            </span>
          )}
          {rule && (
            <span dir="ltr" lang="es">
              {fillTemplate(copy.hero.citation, { article: rule.article, title: rule.title })}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** The first screen: what RoadSense does, the upload button with its notice, and one answer as an example. */
export default function Hero({ copy, locale, example, disabled, error, onUploadClick, onFile, onTryExample, onOpenExample }: HeroProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <p className="inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-label-caps text-label-caps uppercase tracking-widest text-primary-fixed-dim">
          {copy.page.eyebrow}
        </p>
        <h1 className="font-headline-xl text-3xl font-bold leading-tight text-on-surface md:text-[2.6rem]">{copy.page.title}</h1>
        <p className="text-base leading-relaxed text-on-surface-variant">{copy.page.lead}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onUploadClick();
              inputRef.current?.click();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-base font-bold text-on-primary shadow-lg shadow-primary/25 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              upload
            </span>
            {copy.hero.upload}
          </button>
          <button
            type="button"
            onClick={onTryExample}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-5 py-3 text-base font-semibold text-on-surface transition-colors hover:border-primary/70"
          >
            {copy.hero.tryExample}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.target.value = "";
            }}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <p className="text-xs leading-relaxed text-on-surface-variant">
          {copy.upload.notice}{" "}
          <a href="/legal/privacy" className="font-semibold text-primary-fixed-dim underline underline-offset-2">
            {copy.upload.privacy}
          </a>
        </p>
        <p className="text-xs text-on-surface-variant">{copy.hero.trust}</p>
      </div>
      {example && <ExampleCard copy={copy} locale={locale} example={example} disabled={disabled} onOpen={() => onOpenExample(example.scene)} />}
    </section>
  );
}

/** Three steps under the hero: photograph, get the answer, ask "what if…?". */
export function Steps({ copy }: { copy: RoadsenseCopy }) {
  const steps = [copy.steps.snap, copy.steps.answer, copy.steps.ask];
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.title} className="space-y-1.5 rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-sm font-extrabold text-primary-fixed-dim" aria-hidden="true">
            {index + 1}
          </span>
          <h2 className="font-semibold text-on-surface">{step.title}</h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** For judges and the curious: how the answer is checked, the evaluation, and the source code. */
export function HowItChecks({ copy, evaluation, onSource }: { copy: RoadsenseCopy; evaluation: string; onSource: () => void }) {
  return (
    <section className="space-y-2 rounded-2xl border border-dashed border-outline-variant p-4 text-sm leading-relaxed text-on-surface-variant">
      <h2 className="font-semibold text-on-surface">{copy.howItChecks.heading}</h2>
      <p>{copy.howItChecks.body}</p>
      <p>{evaluation}</p>
      <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" onClick={onSource} className="inline-block font-semibold text-primary-fixed-dim underline underline-offset-2">
        {copy.howItChecks.sourceCode}
      </a>
    </section>
  );
}
