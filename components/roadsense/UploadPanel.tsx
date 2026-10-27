import { useId } from "react";
import type { RoadsenseCopy } from "./copy-table";

interface UploadPanelProps {
  copy: RoadsenseCopy;
  /** The resized photo, ready to send; null until the learner picks one. */
  preview: string | null;
  busy: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onAnalyse: () => void;
}

/** Pick a photo, read where it goes, then analyse it: the notice always comes before the button. */
export default function UploadPanel({ copy, preview, busy, error, onFile, onAnalyse }: UploadPanelProps) {
  const inputId = useId();
  return (
    <section aria-labelledby="roadsense-upload" className="space-y-4 rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4 md:p-5">
      <div className="space-y-1">
        <h2 id="roadsense-upload" className="font-headline-xl text-xl font-bold text-on-surface">
          {copy.upload.heading}
        </h2>
        <p className="text-sm text-on-surface-variant">{copy.upload.tip}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {preview && (
          // A data URL of the resized photo.
          <img src={preview} alt="" className="ph-no-capture h-20 w-auto max-w-[8rem] rounded-lg border border-outline-variant/60 object-cover" />
        )}
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:border-primary/70 focus-within:ring-2 focus-within:ring-primary"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            upload
          </span>
          {preview ? copy.upload.change : copy.upload.choose}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
      <button
        type="button"
        onClick={onAnalyse}
        disabled={!preview || busy}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {copy.upload.analyse}
      </button>
    </section>
  );
}
