import { useId } from "react";
import type { RoadsenseCopy } from "./copy-table";

interface UploadPanelProps {
  copy: RoadsenseCopy;
  busy: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onAnalyse: () => void;
}

/**
 * The photo the learner picked, waiting beside it: the notice comes before the button, and
 * nothing is sent until "Analyse this photo", so a wrongly picked photo can be changed first.
 */
export default function UploadPanel({ copy, busy, error, onFile, onAnalyse }: UploadPanelProps) {
  const inputId = useId();
  return (
    <section aria-labelledby="roadsense-upload" className="space-y-4 rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4 md:p-5">
      <h2 id="roadsense-upload" className="font-headline-xl text-xl font-bold text-on-surface">
        {copy.upload.heading}
      </h2>
      <p className="text-sm text-on-surface-variant">{copy.upload.tip}</p>
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
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onAnalyse}
          disabled={busy}
          className="rounded-xl bg-primary px-5 py-3 text-base font-bold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copy.upload.analyse}
        </button>
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:border-primary/70 focus-within:ring-2 focus-within:ring-primary"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            upload
          </span>
          {copy.upload.change}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
    </section>
  );
}
