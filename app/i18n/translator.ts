import {
  directionFor,
  numberLocaleFor,
  type Locale,
} from "./locales.ts";
import { en } from "./messages/en.ts";
import { ar } from "./messages/ar.ts";

export type PluralMessage = {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
};

type English = typeof en;
export type MessageKey = keyof English;

/** The shape the Arabic catalogue must satisfy: same keys, same string-or-plural kind. */
export type CatalogueShape = {
  readonly [K in MessageKey]: English[K] extends string ? string : PluralMessage;
};

type TemplateOf<K extends MessageKey> = English[K] extends string
  ? English[K]
  : English[K][keyof English[K] & string];

type PlaceholderNames<S extends string> =
  S extends `${string}{${infer Name}}${infer Rest}` ? Name | PlaceholderNames<Rest> : never;

type ParamNames<K extends MessageKey> =
  | PlaceholderNames<Extract<TemplateOf<K>, string>>
  | (English[K] extends string ? never : "count");

export type MessageParams<K extends MessageKey> = {
  readonly [Name in ParamNames<K>]: string | number;
};

type TranslateArgs<K extends MessageKey> = [ParamNames<K>] extends [never]
  ? []
  : [params: MessageParams<K>];

export interface Translator {
  readonly locale: Locale;
  readonly dir: "rtl" | "ltr";
  t<K extends MessageKey>(key: K, ...args: TranslateArgs<K>): string;
  formatNumber(value: number): string;
}

const catalogues: Record<Locale, CatalogueShape> = { ar, en };
const translators = new Map<Locale, Translator>();

/** Wraps user-authored text so it keeps its own direction inside translated text. */
export function isolate(text: string): string {
  return `⁨${text}⁩`;
}

export function createTranslator(locale: Locale): Translator {
  let cached = translators.get(locale);
  if (cached) return cached;

  let numbers = new Intl.NumberFormat(numberLocaleFor(locale));
  let plurals = new Intl.PluralRules(locale);
  let catalogue = catalogues[locale];

  function formatValue(value: string | number): string {
    return typeof value === "number" ? numbers.format(value) : value;
  }

  let translator: Translator = {
    locale,
    dir: directionFor(locale),
    formatNumber: (value) => numbers.format(value),
    t(key, ...args) {
      let params = (args[0] ?? {}) as Record<string, string | number>;
      let message: string | PluralMessage = catalogue[key];
      let template: string;
      if (typeof message === "string") {
        template = message;
      } else {
        let count = Number(params.count);
        template = message[plurals.select(count)] ?? message.other;
      }
      // Single pass: interpolated values are never re-scanned for placeholders.
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? formatValue(params[name]) : match,
      );
    },
  };
  translators.set(locale, translator);
  return translator;
}

export function catalogueFor(locale: Locale): CatalogueShape {
  return catalogues[locale];
}
