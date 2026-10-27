"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisResult } from "../../lib/roadsense/types";
import { parseStreamLine, splitLines, type StreamErrorCode, type StreamStage } from "./view";

// One request to a RoadSense route at a time. Curated scenes answer with JSON;
// live analyses stream NDJSON stage lines and then a result or an error line
// (lib/roadsense-host/live.ts). Starting a new request cancels the one before.

export interface AnalysisOutcome {
  result: AnalysisResult | null;
  /** Live what-ifs only: false when the edit didn't come out right. */
  applied?: boolean;
  /** Live what-ifs only: the edited photo. */
  imageDataUrl?: string | null;
  /** Curated what-ifs only: the pre-generated edited photo. */
  imagePath?: string;
}

/** A failure the page explains with its own copy, or with the server's localized message. */
export type AnalysisError = { code: StreamErrorCode | "network" } | { message: string };

export type AnalysisState =
  | { status: "idle" }
  | { status: "running"; stage: StreamStage | null }
  | { status: "done"; outcome: AnalysisOutcome }
  | { status: "error"; error: AnalysisError };

type Finished = Extract<AnalysisState, { status: "done" | "error" }>;

async function errorFrom(response: Response): Promise<AnalysisError> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message !== "") return { message: body.message };
  } catch {
    // Not JSON: fall through to the generic message.
  }
  return { code: "internal" };
}

/** Reads a live route's NDJSON body: stage lines go to `onStage`, the last line decides the outcome. */
export async function readAnalysisStream(response: Response, onStage: (stage: StreamStage) => void): Promise<Finished> {
  const reader = response.body?.getReader();
  if (!reader) return { status: "error", error: { code: "internal" } };
  const decoder = new TextDecoder();
  let buffer = "";
  let finished: Finished | null = null;
  const take = (text: string) => {
    const line = parseStreamLine(text);
    if (line?.type === "stage") onStage(line.stage);
    else if (line?.type === "error") finished = { status: "error", error: { code: line.code } };
    else if (line?.type === "result") {
      finished = { status: "done", outcome: { result: line.result, applied: line.applied, imageDataUrl: line.imageDataUrl } };
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const { lines, rest } = splitLines(done ? `${buffer}\n` : buffer);
    buffer = rest;
    lines.forEach(take);
    if (done) break;
  }
  return finished ?? { status: "error", error: { code: "internal" } };
}

export function useAnalysisStream(): {
  state: AnalysisState;
  run: (url: string, body: Record<string, unknown>) => Promise<Finished | null>;
  reset: () => void;
} {
  const [state, setState] = useState<AnalysisState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: "idle" });
  }, []);

  /** Resolves with the final state, or null when a newer request (or leaving the page) cancelled it. */
  const run = useCallback(async (url: string, body: Record<string, unknown>): Promise<Finished | null> => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ status: "running", stage: null });
    let finished: Finished;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: current.signal,
      });
      if (!response.ok) finished = { status: "error", error: await errorFrom(response) };
      else if (response.headers.get("Content-Type")?.includes("application/json")) {
        const json = (await response.json()) as { result?: AnalysisResult; imagePath?: string };
        finished = json.result ? { status: "done", outcome: { result: json.result, imagePath: json.imagePath } } : { status: "error", error: { code: "internal" } };
      } else {
        finished = await readAnalysisStream(response, (stage) => {
          if (!current.signal.aborted) setState({ status: "running", stage });
        });
      }
    } catch {
      finished = { status: "error", error: { code: "network" } };
    }
    if (current.signal.aborted) return null;
    setState(finished);
    return finished;
  }, []);

  return { state, run, reset };
}
