import { useId, useState, type ReactNode } from "react";
import type { AnalysisResult, Certainty, RoadsenseLocale as Locale, RuleRecord } from "../../lib/roadsense/types";
import type { RoadsenseCopy } from "./copy-table";
import { disagreement, notSureReasons, rulesToShow, showsAmberException, splitSpanishTerms, type NotSureReason } from "./view";

interface ResultCardProps {
  copy: RoadsenseCopy;
  locale: Locale;
  result: AnalysisResult;
  /** The evaluation figures, shown when the badge is explained. */
  evaluation: string;
  cta: ReactNode;
  practiceHref: string;
  onPractice: () => void;
}

// Icons must be in the subset font (scripts/fonts/used_icons.txt) or they render as their names.
const BADGES: Record<Certainty, { icon: string; className: string }> = {
  checked: { icon: "check_circle", className: "border-success/50 bg-success-container text-on-success-container" },
  disagree: { icon: "balance", className: "border-secondary/50 bg-secondary-container text-on-secondary-container" },
  not_sure: { icon: "help", className: "border-outline bg-surface-container-high text-on-surface" },
  outside_scope: { icon: "block", className: "border-outline bg-surface-container-high text-on-surface-variant" },
};

const LABEL = "font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant";

/** Explanation text; in Arabic each Spanish term in brackets is isolated left-to-right. */
function Explained({ text, locale }: { text: string; locale: Locale }) {
  if (locale !== "ar") return <>{text}</>;
  return (
    <>
      {splitSpanishTerms(text).map((part, index) =>
        part.spanish ? (
          <bdi key={index} dir="ltr" lang="es">
            {part.text}
          </bdi>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

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

/** The badge, and on request what it means; "checked" also shows the evaluation figures. */
function Badge({ copy, certainty, evaluation }: { copy: RoadsenseCopy; certainty: Certainty; evaluation: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const badge = BADGES[certainty];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${badge.className}`}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            {badge.icon}
          </span>
          {copy.certainty[certainty].label}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="text-sm font-semibold text-primary-fixed-dim underline underline-offset-2"
        >
          {copy.result.badgeHelp}
        </button>
      </div>
      <div id={panelId} hidden={!open} className="space-y-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3 text-sm text-on-surface-variant">
        <p>{copy.certainty[certainty].explain}</p>
        {certainty === "checked" && <p>{evaluation}</p>}
      </div>
    </div>
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
    <article className="space-y-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3.5">
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

function Answer({ copy, locale, result }: { copy: RoadsenseCopy; locale: Locale; result: AnalysisResult }) {
  const { engine, model } = result;
  if (result.certainty === "checked" && engine.obligation && model) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className={LABEL}>{copy.result.answer}</p>
          <p className="font-headline-xl text-2xl font-bold text-on-surface">{copy.obligations[engine.obligation]}</p>
        </div>
        <div className="space-y-1">
          <h3 className={LABEL}>{copy.result.why}</h3>
          <p className="leading-relaxed text-on-surface">
            <Explained text={model.rationale} locale={locale} />
          </p>
        </div>
        <div className="space-y-1 rounded-xl border border-error/30 bg-error-container/20 p-3.5">
          <h3 className={LABEL}>{copy.result.tempting}</h3>
          <p className="font-semibold text-on-surface">
            <Explained text={model.temptingWrongAnswer} locale={locale} />
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            <Explained text={model.whyWrong} locale={locale} />
          </p>
        </div>
      </div>
    );
  }
  if (result.certainty === "disagree") {
    const rows = [
      { label: copy.result.engine, obligation: engine.obligation },
      { label: copy.result.model, obligation: model?.obligation ?? null },
    ];
    return (
      <div className="space-y-2">
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
      <h3 className={LABEL}>{copy.result.missing}</h3>
      <ul className="list-disc space-y-1 ps-5 text-on-surface">
        {notSureReasons(result).map((reason) => (
          <li key={reason.kind === "unknown" ? reason.code : reason.kind}>{reasonText(copy, reason)}</li>
        ))}
      </ul>
    </div>
  );
}

/** One analysis: badge, answer, the law behind it, and where to practise next. */
export default function ResultCard({ copy, locale, result, evaluation, cta, practiceHref, onPractice }: ResultCardProps) {
  const rules = rulesToShow(result);
  return (
    <div className="space-y-5 rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4 md:p-5">
      <Badge copy={copy} certainty={result.certainty} evaluation={evaluation} />
      <Answer copy={copy} locale={locale} result={result} />
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
      {rules.length > 0 && (
        <section className="space-y-2.5">
          <h3 className={LABEL}>{copy.result.rules}</h3>
          {rules.map((rule) => (
            <Rule key={rule.id} copy={copy} locale={locale} rule={rule} />
          ))}
        </section>
      )}
      {result.modelIds.length > 0 && (
        <p className="text-xs text-on-surface-variant">
          {copy.result.models}: <span dir="ltr">{result.modelIds.join(" · ")}</span>
        </p>
      )}
      <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-sm leading-relaxed text-on-surface">{copy.cta.lead}</p>
        {cta}
        <a href={practiceHref} onClick={onPractice} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-fixed-dim underline-offset-2 hover:underline">
          {copy.cta.practice}
          <span className="material-symbols-outlined text-[18px] rtl:-scale-x-100" aria-hidden="true">
            arrow_forward
          </span>
        </a>
      </div>
    </div>
  );
}
