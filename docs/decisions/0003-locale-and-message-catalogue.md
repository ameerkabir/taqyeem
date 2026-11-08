# 0003 — Arabic/English interface: locale selection and message catalogue

## Status

Proposed (issue #5, expanded scope)

Issue #5 originally covered the catalogue and locale plumbing only, and explicitly
excluded a language switcher and English copy. This change also delivers complete
English copy, the switcher, and the preference route. It does not close #5; the
original acceptance criteria and this expansion should be reviewed together.

## Decision

**Locale selection** (`app/i18n/resolve.ts`, `app/middleware/locale.ts`)

1. A valid `taqyeem_lang` cookie (`ar` or `en`, strictly validated).
2. Otherwise the best supported `Accept-Language` entry. Regional tags map to their base
   language (`en-GB`, `en-US` -> `en`; `ar-SA` -> `ar`). Priorities are honoured and
   `q=0` excludes a language. Matching is done in the app because the installed
   `AcceptLanguage#getPreferred` lets a wildcard override an exclusion.
3. Otherwise Arabic.

The cookie is independent of `taqyeem_session`; it carries no identity and is never
read by authorisation code. Board URLs have no locale prefix.

**Catalogue** (`app/i18n/`)

- `messages/en.ts` is the typing source; `messages/ar.ts` must satisfy the same shape.
  `{name}` placeholders become required, typed parameters of `t()`.
  `catalogue.test.ts` also checks key parity, placeholder parity and the plural
  categories each locale needs.
- Messages are whole sentences. Plural messages are objects selected with
  `Intl.PluralRules`. Numbers are formatted with `Intl.NumberFormat`; Arabic is pinned to
  `ar-u-nu-arab` (plain `ar` yields Latin digits in current ICU) to preserve today's look.
- The catalogue is browser-safe (no server imports, no secrets). Hydrated components
  receive only a serialisable `locale` prop and call `createTranslator(locale)`. Both
  catalogues are therefore part of the client bundle; this is small and avoids passing
  large message maps through the hydration payload.
- Messages are plain text, always rendered escaped. User-authored text interpolated into
  a message is wrapped in Unicode isolates (`isolate()`); standalone user text uses
  `dir="auto"`.

**Content-language boundaries**

- Translated: all UI chrome, validation messages, HTML/JSON/plain-text errors.
- Never translated: board titles, card text, member names, existing category labels.
- Default categories are templates. A new board stores them in the creator's language
  (`createBoard` now takes `categoryLabels`). Existing and custom labels are identical for
  every viewer. No locale column and no category-translation schema were added.
- Language-neutral: routes, query/param names, field names, status enums, limits and
  mutation semantics.

**HTTP**

- `loadLocale()` is the first middleware, so even `cop()`'s 403 (via `onDeny`) is localised.
- `POST /locale` takes `locale` and `returnTo`. `locale` is validated strictly (400
  otherwise). `returnTo` must be a same-origin path; anything else becomes `/`. It sets
  the cookie on a 303. It is a native form, covered by `cop()`.
- Every response gets `Content-Language`, `Vary: Cookie, Accept-Language` (merged with
  any existing `Vary`) and, if none was set, `Cache-Control: private, no-cache`. Nothing
  enables shared caching of personalised pages.
- Frames: SSR Frame subrequests copy `Cookie` and `Accept-Language`, so the cards
  fragment matches the document. `Set-Cookie` from a Frame subrequest does not reach the
  browser, so the cookie is only written by the top-level `POST /locale`.

## Request / locale flow

```
Browser                         Worker (createAppRouter)
-------                         ------------------------
GET /boards/b1?section=s  --->  loadLocale ── cookie? ──► ar|en
 Cookie: taqyeem_lang=…          │            else Accept-Language ► ar|en
 Accept-Language: …              │            else ar
                                 ▼
                         context.i18n {locale, dir, t, formatNumber, returnTo}
                                 │
                       cop ► render ► session ► models ► controller
                                 │
                       Document lang/dir/title + <LocaleSwitcher returnTo>
                       Frame subrequest (copies Cookie + Accept-Language) ► same locale
                       hydrated entries get {locale} ► createTranslator(locale)
                                 ▼
                       Response + Content-Language, Vary, Cache-Control: private

Switch:  <form POST /locale locale=en returnTo=/boards/b1?section=s>
         ► cop ► validate ► 303 Location: <safe returnTo> + Set-Cookie taqyeem_lang
         ► browser reloads the whole document (lang, dir, title, Frames all refresh)
```

## Consequences / limitations

- Native browser validation bubbles follow the browser language.
- `cop()` rejections are plain-text bodies (localised, but not HTML).
- Back/forward cache may show the previous language until reload.
- The language switcher sits above page content on every page; its exact layout in
  each viewport and at 200% zoom needs a browser pass.
- Rebasing onto the D1/worker-context branches (#33, #34) conflicts mechanically in
  `app/router.ts` and in test router setup (`loadLocale()` must be added to each).
