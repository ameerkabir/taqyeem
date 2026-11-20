# Testing layers and CI (#6)

Issue #6 asked for this record as `0004-testing.md`. That number is already
`0004-persistent-board-models.md`, so this is the next free number. It collects the
testing decisions already recorded in `0002-d1-access.md` (D1 adapter, migration
replay, `test:d1`) and `0004-persistent-board-models.md` (model tests, the
`BoardModels` contract, route tests) and adds CI. Those records remain the detail.

## Layers

| Layer | Where | Runs against | Command |
| --- | --- | --- | --- |
| Models | `app/models/**/*.test.ts` | `createTestDatabase()` | `npm test` |
| Routes | `app/**/*.test.ts` using `createAppRouter({ db, … })` and `router.fetch(...)` | `createTestDatabase()` or the `BoardModels` double | `npm test` |
| Local D1 | `test/d1-smoke.ts`, `test/d1-smoke-worker.ts` | `wrangler dev --local` with Miniflare D1 | `npm run test:d1` |
| Browser journeys | `test/*-browser.mjs`, `guided-*.mjs` | `npm run dev` on localhost | `node test/<script>.mjs` |

- `remix test` (Node's built-in SQLite, no Vitest) finds `**/*.test.{ts,tsx}`.
  `NODE_ENV=test` is set by the `test` script.
- `app/test/db.ts` `createTestDatabase()` opens a fresh in-memory SQLite database with
  foreign keys on. It runs every numbered `.sql` file in `database/migrations/` in
  filename order. Wrangler applies the same directory (`migrations_dir` in
  `wrangler.jsonc`). There is no second migration journal. `app/test/db.test.ts` checks
  ordering, isolation and failure cleanup.
- Dependencies reach controllers through `AppDependencies` (`0002-worker-dependencies.md`).
  Nothing imports `cloudflare:workers`, and Node has no such module. A test that
  reached it, even through an import chain, would fail under `npm test`.
- `npm run typecheck` (`tsc --noEmit`) is separate from tests. `remix test` strips
  types and does not check them.
- `npm run test:d1` covers what SQLite cannot show: D1 has no real transactions or
  savepoints, and it encodes values differently. It applies the real migrations with
  `wrangler d1 migrations apply --local` into a temporary `--persist-to` directory,
  serves a test-only Worker from `test/wrangler.d1-smoke.jsonc`, and then deletes the
  directory. That config has no account or `database_id`, so no credentials are
  needed and production D1 is never reached. A run takes about 15 s.

## CI

`.github/workflows/ci.yml` runs on every push and pull request with Node 24
(`engines` requires `>=24.3.0`) and `npm ci`:

- `checks`: `npm run typecheck`, `npm test`, `npm run build`.
- `d1-local`: `npm run test:d1`, as a separate job so a Miniflare failure is easy to
  tell apart from a server-test failure.

The workflow has read-only repository permission, no secrets and no deployment step.
`npm ci` needs `package-lock.json` to match `package.json`; run `npm install` and
commit the lockfile when dependencies change.

## Kept outside CI

- **Browser journeys.** Playwright is deliberately not a dependency. The scripts use
  an existing installation and are run by hand against a local Worker. Setup,
  per-script evidence and the stress-fixture rules are in
  `docs/design/implementation/VERIFICATION.md`. Prerequisites that document omits:
  - `.dev.vars` (gitignored) must define `SESSION_SECRET`, or every request fails
    with `SESSION_SECRET is required`. Any local random value is fine.
  - The scripts default to `BROWSER_BASE_URL=http://127.0.0.1:5173`, the
    `npm run dev` port, and reject any non-localhost URL.
  - Point `PLAYWRIGHT_MODULE` at Playwright's `index.mjs`, and optionally
    `BROWSER_EXECUTABLE` at a Chromium binary, when they are not resolvable from
    the repo.
  - `guided-stress.mjs` writes fixtures into the default local D1 state (`.wrangler/`)
    with `wrangler d1 execute --local`. Run it alone.
- **Remote D1.** `db:migrate:remote` and `db:migrations:list:remote` are never run by
  tests or `ci.yml`. They run only in `migrate.yml`, behind a manual approval on the
  `production-db` environment (see "Deploy and migrations" below).
- **`remix doctor`.** It is run by hand when project structure changes. A known naming
  warning is recorded in `VERIFICATION.md`.

## Commands

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:d1
```

Browser journeys (two terminals):

```sh
npm run db:migrate:local
npm run dev -- --host 127.0.0.1
node test/guided-browser.mjs
```

## Deploy and migrations

Separate from `ci.yml`, which keeps no secrets:

- `.github/workflows/deploy.yml`: every push to `main` runs typecheck and tests, then
  `npm run deploy`. No approval.
- `.github/workflows/migrate.yml`: queued on pushes to `main` that touch
  `database/migrations/**`, or run by hand. A `plan` job lists pending migrations in
  the run summary; the `apply` job waits for approval on the `production-db`
  environment, then runs `npm run db:migrate:remote`.

The two are independent, so a deploy can go out before its migration is approved.
Keep migrations backward compatible with the code already running (add before use,
drop only after code stops using it), or approve the migration before relying on it.

Both need repository secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit, D1: Edit)
and `CLOUDFLARE_ACCOUNT_ID`.
