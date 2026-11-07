import { createCookie } from "remix/cookie";
import { createContextKey, type Middleware, type RequestContext } from "remix/router";
import {
  LOCALE_COOKIE_NAME,
  isLocale,
  type Locale,
} from "../i18n/locales.ts";
import { resolveLocale } from "../i18n/resolve.ts";
import { createTranslator, type Translator } from "../i18n/translator.ts";

export interface I18n extends Translator {
  /** Same-origin path + query of the current request; used by the language switcher. */
  readonly returnTo: string;
}

export const i18nContext = createContextKey<I18n>();

// Independent of the session cookie: locale never touches identity or membership.
const localeCookie = createCookie(LOCALE_COOKIE_NAME, {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365,
});

export function serializeLocaleCookie(locale: Locale, secure: boolean) {
  return localeCookie.serialize(locale, { secure });
}

export async function readLocaleCookie(header: string | null) {
  let value = await localeCookie.parse(header);
  return isLocale(value) ? value : null;
}

function buildI18n(locale: Locale, url: URL): I18n {
  return { ...createTranslator(locale), returnTo: url.pathname + url.search };
}

/**
 * Locale for code that may run without loadLocale() (tiny test routers, error paths).
 * Falls back to Accept-Language, then Arabic; the cookie is only read by loadLocale().
 */
export function getI18n(context: Pick<RequestContext, "request" | "get">): I18n {
  let existing = context.get(i18nContext);
  if (existing) return existing;
  let locale = resolveLocale({
    acceptLanguage: context.request.headers.get("Accept-Language"),
  });
  return buildI18n(locale, new URL(context.request.url));
}

function mergeVary(existing: string | null): string {
  let tokens = (existing ?? "").split(",").map((token) => token.trim()).filter(Boolean);
  if (tokens.includes("*")) return "*";
  let lower = new Set(tokens.map((token) => token.toLowerCase()));
  for (let name of ["Cookie", "Accept-Language"]) {
    if (!lower.has(name.toLowerCase())) tokens.push(name);
  }
  return tokens.join(", ");
}

/** Marks a response as locale-dependent and personal; never overrides existing caching. */
export function withLocaleHeaders(response: Response, locale: Locale): Response {
  let headers = new Headers(response.headers);
  if (!headers.has("Content-Language")) headers.set("Content-Language", locale);
  headers.set("Vary", mergeVary(headers.get("Vary")));
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "private, no-cache");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Resolves the locale once per request: valid preference cookie, then
 * Accept-Language, then Arabic. Runs before any middleware that can reject.
 */
export function loadLocale(): Middleware<{
  key: typeof i18nContext;
  value: I18n;
  property: "i18n";
}> {
  return async (context, next) => {
    let cookie = await readLocaleCookie(context.request.headers.get("Cookie"));
    let locale = resolveLocale({
      cookie,
      acceptLanguage: context.request.headers.get("Accept-Language"),
    });
    context.set(i18nContext, buildI18n(locale, context.url), { property: "i18n" });
    return withLocaleHeaders(await next(), locale);
  };
}
