# Taqyeem Agent Guide

This app was scaffolded with `remix new` and runs on Cloudflare Workers via Vite and
`@cloudflare/vite-plugin`. Use these conventions when continuing to build it out.

## Commands

```sh
npm i
npm run dev
npm run preview
npm run deploy
npm test
npm run typecheck
```

`npm run dev` runs `vite dev`, which serves the app through the Workers runtime (Miniflare)
with HMR — there is no separate Node dev server. `npm run preview` builds and previews the
production Worker locally. `npm run deploy` builds and runs `wrangler deploy`; run
`wrangler login` (or set `CLOUDFLARE_API_TOKEN`) first.

## Building Features

Refer to ./.agents/skills/remix/SKILL.md for the Remix mental model and how to find guides and API READMEs through `node_modules/remix/INDEX.md`.

## Starter Layout

- `server.ts` is the Worker's `fetch` entry, wired up by `wrangler.jsonc` and `vite.config.ts`
- `client.ts` is the browser runtime entry; it resolves `clientEntry()` components via
  `import.meta.glob` over `app/**/public/**` — add new browser-hydrated components there
- `app/routes.ts` defines the shared route contract used by server and browser modules for type-safe hrefs
- `app/router.ts` wires routes to controllers and installs the standard Remix component renderer used by actions
- Put top-level route actions in `app/actions/controller.tsx`; add `app/actions/<route-key>/controller.tsx` for nested route maps. `app/actions/controller.test.ts` is the root controller's router smoke test
- `app/actions/home-page.tsx` and `app/actions/document.tsx` render the route-owned starter UI
- `app/actions/public/` contains browser-hydrated components (e.g. the prompt button); each
  uses `clientEntry('/app/actions/public/<file>.tsx#<Export>', ...)` with a literal path, not
  `import.meta.url` — Workers has no real module filesystem, so that's what stays portable
  between `vite dev` and the deployed Worker
- Root `public/` contains static files served unchanged from the app root

This starter intentionally begins small; add directories like `app/data/`, `app/middleware/`, `app/ui/`, and `test/` only when you need them.
