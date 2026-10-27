import type { AnalysisResult, CuratedScene } from "./types";

// Scores one run of the pipeline over the curated scenes against their ground
// truth. An answerable scene counts as right only when it is "checked" with the
// expected obligation; a checked wrong answer is the failure that must never
// happen, so it is counted on its own.

export interface EvalRow {
  sceneId: string;
  expected: CuratedScene["expected"];
  result: AnalysisResult | null;
  error: string | null;
}

export interface EvalReport {
  answerable: { total: number; correct: number; notSure: number; checkedWrong: number };
  /** Checked answers that are wrong on any kind of scene: a checked answer where the honest one is "not sure" or "outside scope" is wrong too. */
  checkedWrong: number;
  abstain: { total: number; correct: number };
  outOfScope: { total: number; correct: number };
  citations: { total: number; valid: number };
  schema: { total: number; valid: number };
  latencyMs: { p50: number; p95: number };
  costUsd: { total: number; perScene: number };
  byRule: Record<string, { total: number; correct: number }>;
  failures: string[];
}

/** The targets renderEvalMarkdown prints as met or MISSED. */
export const TARGETS = { answerableCorrect: 0.9, checkedWrong: 0, abstainCorrect: 0.8, citations: 1, schema: 1, p95Ms: 20_000 } as const;

/** Nearest-rank percentile: the smallest value with at least p% of the values at or below it. */
export function nearestRank(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

function isCorrect({ expected, result }: EvalRow): boolean {
  if (!result) return false;
  if (expected.kind === "abstain") return result.certainty === "not_sure";
  if (expected.kind === "out_of_scope") return result.certainty === "outside_scope";
  return result.certainty === "checked" && result.model?.obligation === expected.obligation;
}

function describeMiss(row: EvalRow): string {
  if (!row.result) return `${row.sceneId}: error ${row.error ?? "unknown"}`;
  const { certainty, model } = row.result;
  const got = model ? `${certainty} (${model.obligation})` : certainty;
  const wanted =
    row.expected.kind === "answerable" ? `checked (${row.expected.obligation})` : row.expected.kind === "abstain" ? "not_sure" : "outside_scope";
  return `${row.sceneId}: expected ${wanted}, got ${got}`;
}

export function scoreRun(rows: readonly EvalRow[], corpusIds: readonly string[]): EvalReport {
  const answerable = rows.filter((row) => row.expected.kind === "answerable");
  const abstain = rows.filter((row) => row.expected.kind === "abstain");
  const outOfScope = rows.filter((row) => row.expected.kind === "out_of_scope");
  const results = rows.flatMap((row) => (row.result ? [row.result] : []));

  // A citation is valid when the corpus has it and it belongs to the scene: one of the
  // expected rules, the engine's, or the excerpts retrieved for the model.
  const citations = rows.flatMap(({ expected, result }) => {
    if (!result?.model) return [];
    const allowed = new Set([...expected.ruleIds, ...result.engine.ruleIds, ...result.rules.map((rule) => rule.id)]);
    return result.model.ruleIds.map((id) => corpusIds.includes(id) && allowed.has(id));
  });

  const byRule: Record<string, { total: number; correct: number }> = {};
  for (const row of answerable) {
    for (const id of row.expected.ruleIds) {
      const entry = byRule[id] ?? { total: 0, correct: 0 };
      byRule[id] = { total: entry.total + 1, correct: entry.correct + (isCorrect(row) ? 1 : 0) };
    }
  }

  const latencies = results.map((result) => result.latencyMs);
  const totalCost = results.reduce((sum, result) => sum + result.costUsd, 0);
  return {
    answerable: {
      total: answerable.length,
      correct: answerable.filter(isCorrect).length,
      notSure: answerable.filter((row) => row.result?.certainty === "not_sure").length,
      checkedWrong: answerable.filter((row) => row.result?.certainty === "checked" && row.result.model?.obligation !== row.expected.obligation).length,
    },
    checkedWrong: rows.filter(
      (row) => row.result?.certainty === "checked" && (row.expected.kind !== "answerable" || row.result.model?.obligation !== row.expected.obligation),
    ).length,
    abstain: { total: abstain.length, correct: abstain.filter(isCorrect).length },
    outOfScope: { total: outOfScope.length, correct: outOfScope.filter(isCorrect).length },
    citations: { total: citations.length, valid: citations.filter(Boolean).length },
    // A decision rejected for its shape leaves a decided engine without a model answer: that output was not valid.
    schema: { total: rows.length, valid: results.filter((result) => result.engine.status !== "decided" || result.model !== null).length },
    latencyMs: { p50: nearestRank(latencies, 50), p95: nearestRank(latencies, 95) },
    costUsd: { total: totalCost, perScene: results.length > 0 ? totalCost / results.length : 0 },
    byRule,
    failures: rows.filter((row) => !isCorrect(row)).map(describeMiss),
  };
}

const share = (part: number, whole: number): number => (whole === 0 ? 1 : part / whole);
const percent = (part: number, whole: number): string => (whole === 0 ? "n/a" : `${Math.round((100 * part) / whole)}%`);
const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;

export function renderEvalMarkdown(report: EvalReport, meta: { mode: "live" | "replay"; date: string; modelIds: string[] }): string {
  const { answerable: a, abstain, outOfScope, citations, schema, latencyMs, costUsd } = report;
  const rows: [string, string, string, boolean | null][] = [
    ["Answerable scenes answered right and checked", `${a.correct}/${a.total} (${percent(a.correct, a.total)})`, "≥ 90%", share(a.correct, a.total) >= TARGETS.answerableCorrect],
    ["Wrong answers marked checked", String(report.checkedWrong), "0", report.checkedWrong === TARGETS.checkedWrong],
    ["Answerable scenes left not sure", `${a.notSure}/${a.total}`, "reported", null],
    ["Abstain scenes answered not sure", `${abstain.correct}/${abstain.total} (${percent(abstain.correct, abstain.total)})`, "≥ 80%", share(abstain.correct, abstain.total) >= TARGETS.abstainCorrect],
    ["Out-of-scope scenes caught", `${outOfScope.correct}/${outOfScope.total}`, "reported", null],
    ["Valid citations", `${citations.valid}/${citations.total} (${percent(citations.valid, citations.total)})`, "100%", share(citations.valid, citations.total) >= TARGETS.citations],
    ["Valid structured output", `${schema.valid}/${schema.total} (${percent(schema.valid, schema.total)})`, "100%", share(schema.valid, schema.total) >= TARGETS.schema],
    ["Latency p50 / p95", `${seconds(latencyMs.p50)} / ${seconds(latencyMs.p95)}`, "p95 ≤ 20 s", latencyMs.p95 <= TARGETS.p95Ms],
    ["Cost", `$${costUsd.total.toFixed(3)} ($${costUsd.perScene.toFixed(4)} a scene)`, "reported", null],
  ];
  const ruleRows = Object.entries(report.byRule)
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([id, { total, correct }]) => `| ${id} | ${total} | ${correct} |`);
  return [
    "# RoadSense evaluation",
    "",
    `${meta.mode === "live" ? "Live run" : "Replay of the recorded live run"}, ${meta.date}. Models: ${meta.modelIds.join(", ")}.`,
    "",
    "| Measure | Result | Target | Status |",
    "|---|---|---|---|",
    ...rows.map(([label, value, target, met]) => `| ${label} | ${value} | ${target} | ${met === null ? "" : met ? "met" : "**MISSED**"} |`),
    "",
    "## By rule (answerable scenes)",
    "",
    "| Rule | Scenes | Answered right and checked |",
    "|---|---|---|",
    ...ruleRows,
    "",
    "## Scenes not answered as expected",
    "",
    ...(report.failures.length > 0 ? report.failures.map((failure) => `- ${failure}`) : ["None."]),
    "",
  ].join("\n");
}
