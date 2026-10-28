"use client";

import { useId, useState, type FormEvent, type Ref } from "react";
import { MAX_WHATIF_TEXT } from "../../lib/roadsense/understand";
import type { RoadsenseCopy } from "./copy-table";
import { whatIfLabelKey, type WhatIfChip } from "./view";

interface WhatIfBoxProps {
  copy: RoadsenseCopy;
  /** The what-ifs this photo offers, shown as suggestions. */
  chips: WhatIfChip[];
  /** On the learner's own photo, each what-if counts as one analysis. */
  live: boolean;
  disabled: boolean;
  /** The text box, so the page can put keyboard focus back in it. */
  inputRef?: Ref<HTMLInputElement>;
  onAsk: (words: string) => void;
  /** The chip and its label, which the thread shows as the learner's words. */
  onChoose: (chip: WhatIfChip, words: string) => void;
}

const CHIP =
  "rounded-full border border-outline-variant bg-surface-container px-3.5 py-2 text-sm font-medium text-on-surface transition-colors hover:border-primary/70 disabled:cursor-not-allowed disabled:opacity-50";

/** The typed "What if…?" box, with the photo's own what-ifs as suggestions under it. */
export default function WhatIfBox({ copy, chips, live, disabled, inputRef, onAsk, onChoose }: WhatIfBoxProps) {
  const [text, setText] = useState("");
  const inputId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const words = text.trim();
    if (disabled || words === "") return;
    onAsk(words);
    setText("");
  }

  return (
    <section className="space-y-2.5">
      <form onSubmit={submit} className="space-y-2">
        <label htmlFor={inputId} className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
          {copy.whatIf.heading}
        </label>
        <div className="flex items-center gap-2 rounded-2xl border-[1.5px] border-primary/60 bg-surface-container-lowest p-1.5 ps-3.5 focus-within:border-primary">
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={text}
            maxLength={MAX_WHATIF_TEXT}
            onChange={(event) => setText(event.target.value)}
            placeholder={copy.whatIf.placeholder}
            autoComplete="off"
            enterKeyHint="send"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-on-surface placeholder:text-on-surface-variant focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={disabled || text.trim() === ""}
            className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.whatIf.ask}
          </button>
        </div>
      </form>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const label = copy.whatIf[whatIfLabelKey(chip.edit)];
            return (
              <button key={chip.key} type="button" className={CHIP} disabled={disabled} onClick={() => onChoose(chip, label)}>
                {label}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs leading-relaxed text-on-surface-variant">
        {copy.whatIf.hint}
        {live ? ` ${copy.whatIf.liveNote}` : ""}
      </p>
    </section>
  );
}
