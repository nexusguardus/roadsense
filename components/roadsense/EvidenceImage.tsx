import { boxStyle, type EvidenceOverlay } from "./view";

interface EvidenceImageProps {
  src: string;
  alt: string;
  /** "AI-generated" or "AI-edited" over the photo; null for the learner's own photo. */
  tag: string | null;
  overlays: EvidenceOverlay[];
  busy: boolean;
}

/**
 * The photo with an outline around each fact the answer depends on: solid where
 * SAM 3.1 confirmed it, dashed where it didn't. Boxes are on the 0-1000 grid of
 * the photo itself, so they use physical left/top even on right-to-left pages.
 */
export default function EvidenceImage({ src, alt, tag, overlays, busy }: EvidenceImageProps) {
  return (
    <figure className="relative overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest">
      {/* A plain <img>: uploads and live edits are data URLs, and the outlines need the photo's exact box. */}
      <img src={src} alt={alt} className="block h-auto w-full" decoding="async" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {overlays.map((overlay) => (
          // The outline sits a few pixels outside the box, with a light halo, so it shows even on a sign's own border.
          <span key={overlay.factId} className="absolute" style={boxStyle(overlay.box)}>
            <span
              className={
                overlay.confirmed
                  ? "absolute -inset-1.5 rounded-lg border-[3px] border-success bg-success/15 shadow-[0_0_0_2px_rgba(255,255,255,0.85),0_0_12px_rgba(16,185,129,0.6)]"
                  : "absolute -inset-1.5 rounded-lg border-[3px] border-dashed border-tertiary bg-tertiary/10 shadow-[0_0_0_2px_rgba(2,6,23,0.7)]"
              }
            />
          </span>
        ))}
      </div>
      {tag && (
        <figcaption className="absolute start-2 top-2 rounded-full bg-surface-container-lowest/80 px-2.5 py-1 text-[11px] font-semibold text-on-surface backdrop-blur">
          {tag}
        </figcaption>
      )}
      {busy && <div className="absolute inset-0 bg-surface/40 motion-safe:animate-pulse" aria-hidden="true" />}
    </figure>
  );
}
