"use client";

import { useReducer, useRef } from "react";
import type { RoadsenseLocale as Locale } from "../../lib/roadsense/types";
import { createThreadActions } from "./thread-actions";
import { askUnderstand } from "./understand-client";
import type { AnalysisState } from "./useAnalysisStream";
import { EMPTY_THREAD, threadBusy, threadReducer, type ThreadState } from "./view";

export { outcomeOf, type ThreadSubject } from "./thread-actions";

type Finished = Extract<AnalysisState, { status: "done" | "error" }>;

interface ThreadDeps {
  locale: Locale;
  run: (url: string, body: Record<string, unknown>) => Promise<Finished | null>;
  onEvent: (name: string, params?: Record<string, unknown>) => void;
}

/** The what-if thread: its state in a reducer, its requests in thread-actions.ts. */
export function useWhatIfThread({ locale, run, onEvent }: ThreadDeps) {
  const [thread, dispatch] = useReducer(threadReducer, EMPTY_THREAD);
  // Requests outlive renders: they read the newest state to address their entry.
  const latest = useRef<ThreadState>(thread);
  latest.current = thread;
  const actions = createThreadActions({ locale, getState: () => latest.current, dispatch, run, understand: askUnderstand, onEvent });
  return {
    thread,
    busy: threadBusy(thread),
    ...actions,
    select: (id: number | null) => dispatch({ type: "select", id }),
    reset: () => dispatch({ type: "reset" }),
  };
}
