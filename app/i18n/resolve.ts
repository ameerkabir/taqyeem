import { AcceptLanguage } from "remix/headers/accept-language";
import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "./locales.ts";

/**
 * Picks a supported locale from an Accept-Language header.
 *
 * Regional tags map to their base language (en-GB -> en, ar-SA -> ar). Priorities
 * are honoured, and `q=0` on a bare language excludes it. The installed parser's
 * getPreferred() lets a wildcard override an exclusion, so matching is done here.
 */
export function negotiateLocale(header: string | null | undefined): Locale | null {
  if (!header) return null;

  let entries = [...AcceptLanguage.from(header)]
    .filter(([, weight]) => Number.isFinite(weight))
    .sort((a, b) => b[1] - a[1]);

  let excluded = new Set<string>();
  for (let [tag, weight] of entries) {
    if (weight <= 0 && isLocale(tag)) excluded.add(tag);
  }

  for (let [tag, weight] of entries) {
    if (weight <= 0) continue;
    if (tag === "*") {
      return LOCALES.find((locale) => !excluded.has(locale)) ?? null;
    }
    let base = tag.split("-")[0];
    if (isLocale(base) && !excluded.has(base)) return base;
  }
  return null;
}

export function resolveLocale(input: {
  cookie?: unknown;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  return negotiateLocale(input.acceptLanguage) ?? DEFAULT_LOCALE;
}
