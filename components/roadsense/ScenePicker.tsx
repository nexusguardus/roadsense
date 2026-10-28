"use client";

import { useState } from "react";
import type { RoadsenseCopy } from "./copy-table";
import type { WhatIfChip } from "./view";

export interface SceneSummary {
  id: string;
  title: string;
  imagePath: string;
  /** A 560 px copy for the grid (scripts/roadsense/thumbnails.ts). */
  thumbPath: string;
  whatIfs: WhatIfChip[];
}

interface ScenePickerProps {
  copy: RoadsenseCopy;
  scenes: SceneSummary[];
  selectedId: string | null;
  /** True while the learner's own photo is being analysed: leaving would discard an analysis already counted. */
  disabled: boolean;
  onSelect: (scene: SceneSummary) => void;
}

/** How many examples a phone shows in a row before "See all". */
const FIRST_ROW = 6;

/**
 * The curated scenes; their answers were worked out in advance. A grid on wider screens; on a
 * phone, a scrolling row of the first six until the learner asks to see them all.
 */
export default function ScenePicker({ copy, scenes, selectedId, disabled, onSelect }: ScenePickerProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section aria-labelledby="roadsense-scenes" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="roadsense-scenes" className="font-headline-xl text-xl font-bold text-on-surface">
          {copy.examples.heading}
        </h2>
        <p className="text-xs text-on-surface-variant">
          {copy.scenes.aiGenerated} · {copy.scenes.precomputed}
        </p>
      </div>
      <ul
        className={
          expanded
            ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            : "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4"
        }
      >
        {scenes.map((scene, index) => {
          const selected = scene.id === selectedId;
          return (
            <li key={scene.id} className={expanded ? "" : `w-40 shrink-0 snap-start md:w-auto ${index >= FIRST_ROW ? "hidden md:block" : ""}`}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onSelect(scene)}
                className={`group block w-full overflow-hidden rounded-xl border text-start transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected ? "border-primary ring-2 ring-primary/50" : "border-outline-variant/60 hover:border-primary/60"
                }`}
              >
                <span className="relative block aspect-[3/2] bg-surface-container-lowest">
                  <img
                    src={scene.thumbPath}
                    alt=""
                    width={560}
                    height={373}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
                  />
                </span>
                <span className="block bg-surface-container px-2.5 py-2 text-[13px] font-medium leading-snug text-on-surface">{scene.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {scenes.length > FIRST_ROW && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="text-sm font-semibold text-primary-fixed-dim underline underline-offset-2 md:hidden"
        >
          {expanded ? copy.examples.showFewer : copy.examples.seeAll}
        </button>
      )}
    </section>
  );
}
