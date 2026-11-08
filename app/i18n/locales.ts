// Browser-safe: no server imports. Hydrated components import this module too.
export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE_NAME = "taqyeem_lang";

// Endonyms are fixed on purpose: they never depend on the active locale.
export const LOCALE_NAMES: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

// `ar` is pinned to Arabic-Indic digits; plain "ar" resolves to Latin digits in current ICU.
const NUMBER_LOCALES: Record<Locale, string> = {
  ar: "ar-u-nu-arab",
  en: "en",
};

export function numberLocaleFor(locale: Locale): string {
  return NUMBER_LOCALES[locale];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function directionFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
