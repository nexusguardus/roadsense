import type { RoadsenseLocale as Locale } from "../../lib/roadsense/types";
import { splitSpanishTerms } from "./view";

/**
 * Text that may hold Spanish exam terms in brackets. In Arabic each one is isolated left-to-right
 * (CLAUDE.md keeps those terms), or its brackets and words reorder.
 */
export default function Explained({ text, locale }: { text: string; locale: Locale }) {
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
