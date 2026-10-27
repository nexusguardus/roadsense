import type { RoadsenseCopy } from "./copy-table";
import type { WhatIfEdit } from "../../lib/roadsense/types";
import { whatIfLabelKey } from "./view";

export interface WhatIfChip {
  key: string;
  edit: WhatIfEdit;
}

interface WhatIfBarProps {
  copy: RoadsenseCopy;
  chips: WhatIfChip[];
  /** The what-if on screen, or null for the original scene. */
  activeKey: string | null;
  /** Live edits on the learner's photo each count as one analysis. */
  live: boolean;
  disabled: boolean;
  onSelect: (chip: WhatIfChip | null) => void;
}

const CHIP = "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const IDLE = `${CHIP} border-outline-variant bg-surface-container text-on-surface hover:border-primary/70`;
const ACTIVE = `${CHIP} border-primary bg-primary/15 text-primary-fixed`;

/** One chip per change that would alter the answer, plus a way back to the original. */
export default function WhatIfBar({ copy, chips, activeKey, live, disabled, onSelect }: WhatIfBarProps) {
  if (chips.length === 0) return null;
  return (
    <section aria-labelledby="roadsense-whatif" className="space-y-2.5">
      <h2 id="roadsense-whatif" className="font-label-caps text-label-caps uppercase text-on-surface-variant">
        {copy.whatIf.heading}
      </h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={activeKey === null ? ACTIVE : IDLE} aria-pressed={activeKey === null} disabled={disabled} onClick={() => onSelect(null)}>
          {copy.whatIf.original}
        </button>
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={activeKey === chip.key ? ACTIVE : IDLE}
            aria-pressed={activeKey === chip.key}
            disabled={disabled}
            onClick={() => onSelect(chip)}
          >
            {copy.whatIf[whatIfLabelKey(chip.edit)]}
          </button>
        ))}
      </div>
      {live && <p className="text-xs text-on-surface-variant">{copy.whatIf.liveNote}</p>}
    </section>
  );
}
