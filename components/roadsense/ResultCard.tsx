import type { ReactNode } from "react";
import type { AnalysisResult, Certainty, RoadsenseLocale as Locale, RuleRecord, SceneFacts } from "../../lib/roadsense/types";
import type { RoadsenseCopy } from "./copy-table";
import Explained from "./Explained";
import { disagreement, notSureReasons, rulesToShow, showsAmberException, withoutFactIds, type NotSureReason } from "./view";

interface ResultCardProps {
  copy: RoadsenseCopy;
  locale: Locale;
  result: AnalysisResult;
  /** The evaluation figures, shown when a checked badge is explained. */
  evaluation: string;
  cta?: ReactNode;
  practiceHref?: string;
  onPractice?: () => void;
  /** In the what-if thread: a smaller verdict, and no pass offer or practice link. */
  compact?: boolean;
}

// Icons must be in the subset font (scripts/fonts/used_icons.txt) or they render as their names.
const BADGES: Record<Certainty, { icon: string; className: string }> = {
  checked: { icon: "check_circle", className: "border-success/50 bg-success-container text-on-success-container" },
  disagree: { icon: "balance", className: "border-secondary/50 bg-secondary-container text-on-secondary-container" },
  not_sure: { icon: "help", className: "border-tertiary/50 bg-tertiary-container/40 text-on-tertiary-container" },
  outside_scope: { icon: "block", className: "border-outline bg-surface-container-high text-on-surface-variant" },
};

const LABEL = "font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant";

function reasonText(copy: RoadsenseCopy, reason: NotSureReason): string {
  switch (reason.kind) {
    case "unknown":
      return copy.unknowns[reason.code];
    case "nothing_to_confirm":
      return copy.result.nothingToConfirm;
    case "unconfirmed":
      return copy.result.unconfirmed;
    case "low_confidence":
      return copy.result.lowConfidence;
    case "no_explanation":
      return copy.result.noExplanation;
    default:
      return copy.result.unsettled;
  }
}

/** A closed section the learner opens: the details stay out of the main reading. */
function Fold({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-outline-variant/60 bg-surface-container-lowest">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        {summary}
        <span className="material-symbols-outlined text-[18px] transition-transform group-open:rotate-90 rtl:-scale-x-100" aria-hidden="true">
          arrow_forward
        </span>
      </summary>
      <div className="space-y-2.5 border-t border-outline-variant/40 px-3.5 py-3">{children}</div>
    </details>
  );
}

function Badge({ text, certainty }: { text: string; certainty: Certainty }) {
  const badge = BADGES[certainty];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${badge.className}`}>
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        {badge.icon}
      </span>
      {text}
    </span>
  );
}

/** The date tags DriveIQ uses (lib/i18n dateLocaleTag): Arabic month names with Western digits. */
const DATE_LOCALES: Record<Locale, string> = { es: "es-ES", en: "en-GB", fr: "fr-FR", ar: "ar-u-nu-latn" };

function versionDate(locale: Locale, isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

/** The BOE excerpt word for word in Spanish, then its plain-language explanation. */
function Rule({ copy, locale, rule }: { copy: RoadsenseCopy; locale: Locale; rule: RuleRecord }) {
  return (
    <article className="space-y-2">
      <div dir="ltr" lang="es" className="space-y-1.5 text-start">
        <p className="text-sm font-semibold text-on-surface">
          {rule.article} · {rule.title}
        </p>
        <blockquote className="border-s-2 border-primary/60 ps-3 text-sm leading-relaxed text-on-surface">{rule.excerptEs}</blockquote>
      </div>
      <p className="text-xs text-on-surface-variant">
        {copy.result.officialText} ·{" "}
        <a href={rule.boeUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-fixed-dim underline underline-offset-2">
          {copy.result.source}
        </a>{" "}
        · {copy.result.versionSince} {versionDate(locale, rule.versionDate)}
      </p>
      <p className="text-sm leading-relaxed text-on-surface">
        <span className="font-semibold">{copy.result.plainWords}:</span> <Explained text={rule.explanation[locale]} locale={locale} />
      </p>
    </article>
  );
}

/** What Muse Spark wrote, without the fact ids it was given ("Une voiture (u1) arrive"). */
function ModelText({ copy, locale, facts, text }: { copy: RoadsenseCopy; locale: Locale; facts: SceneFacts; text: string }) {
  return <Explained text={withoutFactIds(text, facts, copy.factNames, locale)} locale={locale} />;
}

/** The verdict and its badge: the duty when checked, otherwise the certainty in plain words. */
function Verdict({ copy, locale, result, compact }: { copy: RoadsenseCopy; locale: Locale; result: AnalysisResult; compact: boolean }) {
  const { certainty, engine } = result;
  const size = compact ? "text-xl" : "text-2xl";
  const checked = certainty === "checked" && engine.obligation !== null;
  const text = checked && engine.obligation ? copy.obligations[engine.obligation] : copy.certainty[certainty].label;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className={`font-headline-xl font-bold text-on-surface ${size}`}>
        <Explained text={text} locale={locale} />
      </p>
      {checked && <Badge text={copy.certainty.checked.label} certainty="checked" />}
      {certainty === "not_sure" && <Badge text={copy.certainty.not_sure.note} certainty="not_sure" />}
    </div>
  );
}

/** What backs the verdict: the rationale when checked, otherwise why there is no checked answer. */
function Body({ copy, locale, result }: { copy: RoadsenseCopy; locale: Locale; result: AnalysisResult }) {
  const { engine, model } = result;
  if (result.certainty === "checked" && engine.obligation && model) {
    return (
      <p className="leading-relaxed text-on-surface">
        <ModelText copy={copy} locale={locale} facts={result.facts} text={model.rationale} />
      </p>
    );
  }
  if (result.certainty === "disagree") {
    const rows = [
      { label: copy.result.engine, obligation: engine.obligation },
      { label: copy.result.model, obligation: model?.obligation ?? null },
    ];
    return (
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-on-surface-variant">{copy.certainty.disagree.explain}</p>
        <dl className="grid gap-2">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-xl bg-surface-container-lowest px-3.5 py-2.5">
              <dt className="text-sm text-on-surface-variant">{row.label}</dt>
              <dd className="font-semibold text-on-surface">{row.obligation ? copy.obligations[row.obligation] : "—"}</dd>
            </div>
          ))}
        </dl>
        {disagreement(result) === "citation" && <p className="text-sm text-on-surface-variant">{copy.result.citationMismatch}</p>}
      </div>
    );
  }
  if (result.certainty === "outside_scope") {
    return <p className="leading-relaxed text-on-surface">{copy.outOfScope[result.facts.outOfScopeReason ?? "other"]}</p>;
  }
  return (
    <div className="space-y-1.5">
      <p className="text-sm leading-relaxed text-on-surface-variant">{copy.certainty.not_sure.explain}</p>
      <h3 className={LABEL}>{copy.result.missing}</h3>
      <ul className="list-disc space-y-1 ps-5 text-on-surface">
        {notSureReasons(result).map((reason) => (
          <li key={reason.kind === "unknown" ? reason.code : reason.kind}>{reasonText(copy, reason)}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One analysis in plain words: the verdict and its badge, what backs it, and folded details
 * (why people get it wrong, the law, what "Double-checked" means). "Not sure" shows what is
 * missing and never the law, so the law can't imply the answer it withholds.
 */
export default function ResultCard({ copy, locale, result, evaluation, cta, practiceHref, onPractice, compact = false }: ResultCardProps) {
  const rules = rulesToShow(result);
  const { model } = result;
  const checked = result.certainty === "checked" && model !== null;
  return (
    <div className={`space-y-4 rounded-2xl border border-outline-variant/60 bg-surface-container-low ${compact ? "p-3.5" : "p-4 md:p-5"}`}>
      <Verdict copy={copy} locale={locale} result={result} compact={compact} />
      <Body copy={copy} locale={locale} result={result} />
      {showsAmberException(result) && (
        <p className="rounded-xl border border-tertiary/40 bg-tertiary-container/30 p-3 text-sm leading-relaxed text-on-tertiary-container">
          {copy.result.amberException}
        </p>
      )}
      {result.evidence.length > 0 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-on-surface-variant">
          <span className="mt-0.5 inline-flex shrink-0 gap-1" aria-hidden="true">
            <span className="h-3 w-4 rounded-sm border-2 border-success" />
            <span className="h-3 w-4 rounded-sm border-2 border-dashed border-tertiary" />
          </span>
          {copy.result.evidence}
        </p>
      )}
      {(checked || rules.length > 0) && (
        <div className="space-y-2">
          {checked && model && (
            <Fold summary={copy.result.whyWrongFold}>
              <p className="font-semibold text-on-surface">
                <ModelText copy={copy} locale={locale} facts={result.facts} text={model.temptingWrongAnswer} />
              </p>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                <ModelText copy={copy} locale={locale} facts={result.facts} text={model.whyWrong} />
              </p>
            </Fold>
          )}
          {rules.length > 0 && (
            <Fold summary={copy.result.lawFold}>
              {rules.map((rule) => (
                <Rule key={rule.id} copy={copy} locale={locale} rule={rule} />
              ))}
            </Fold>
          )}
          {checked && (
            <Fold summary={copy.result.badgeHelp}>
              <p className="text-sm leading-relaxed text-on-surface-variant">{copy.certainty.checked.explain}</p>
              <p className="text-sm leading-relaxed text-on-surface-variant">{evaluation}</p>
              {result.modelIds.length > 0 && (
                <p className="text-xs text-on-surface-variant">
                  {copy.result.models}: <span dir="ltr">{result.modelIds.join(" · ")}</span>
                </p>
              )}
            </Fold>
          )}
        </div>
      )}
      {!compact && (cta || practiceHref) && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <p className="text-sm leading-relaxed text-on-surface">{copy.cta.lead}</p>
          {cta}
          {practiceHref && (
            <a
              href={practiceHref}
              onClick={onPractice}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary-fixed-dim underline-offset-2 hover:underline"
            >
              {copy.cta.practice}
              <span className="material-symbols-outlined text-[18px] rtl:-scale-x-100" aria-hidden="true">
                arrow_forward
              </span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
