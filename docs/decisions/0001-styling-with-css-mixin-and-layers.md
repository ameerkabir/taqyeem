# 0001 — Styling with `css()` and cascade layers

## Status
Accepted (issue #4)

## Decision
- Component styles use Remix's `css(...)` mixin from `remix/component`, defined as module-level constants and reading `var(--…)` tokens.
- Global styles live in one static stylesheet, `public/app.css`, served by Workers Assets and linked in `Document`'s `<head>`.
- `app.css` declares the layer order `@layer base, rmx, app;`. Tokens, `@font-face` and the reset are in `base`, so `css()` rules (emitted in `rmx`) override them.
- Only CSS logical properties are used (`marginInlineStart`, `paddingBlock`, …), never `left`/`right`.
- `lang` and `dir` on `<html>` come from the active locale (`Document`'s `locale` prop), not from components.
- The Arabic font (IBM Plex Sans Arabic, 400/500/700) is self-hosted in `public/fonts/` with `font-display: swap`.

## Consequence: CSP
`css()` output is inline `<style data-rmx-style>`. The Content Security Policy in #24 must allow it with a nonce on those style elements or `'unsafe-inline'` for `style-src`.

## Note
Unlayered global CSS beats every layer. Keep global styles inside `@layer base` (or `app`) or they will override `css()` rules.
