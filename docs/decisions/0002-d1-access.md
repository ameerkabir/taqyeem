# Application-owned D1 driver (#2)

## Decision and compatibility

Keep Remix 3.1.0 and implement a small local `DatabaseDriver` in
`bootstrap/d1-driver.ts`. Models will depend on `Database` from `remix/data-table`.
No schema or application model queries are part of this change.

Inspected the installed `remix/INDEX.md`, data-table and SQLite READMEs, and
`@remix-run/data-table/dist/lib/driver.d.ts`, database/query types and execution
code. The installed driver contract includes execution, script execution,
transaction lifecycle, savepoints, table/column introspection, wipe and close,
plus explicit capabilities. The installed SQLite SQL compiler is private, so we
do not import its internal files or bring its Node runtime into the Worker.

Evaluated Sergio Xalambrí's `@sdxc/data-table-d1`: published release 2026.10.24
(gitHead `f9db0f8f1f51a256e74b94b0f4b1db4be9880370`) declares exact peer
Remix 3.1.0. Current monorepo main, previously inspected at
`0a0ab2412c89ffc0756ba27477e528ea831f5ca1`, declares 3.2.0 instead. The published
release was compatible, but the owner chose a locally maintained adapter for
learning and control. The temporary dependency was removed; package-lock has no
net changes. SQL compilation/encoding patterns were informed by that reference;
its attribution and MIT notice are retained in `bootstrap/LICENSE.data-table-d1`.

Tradeoff: we own SQL generation, encoding, error paths and compatibility testing.
This is intentionally a subset of the installed API, not a general driver package.
Any Remix upgrade requires checking the installed `DatabaseDriver` contract and
rerunning local D1 checks. Extend only for a concrete model query that needs it.

## Boundary and lifetimes

```text
server.ts: env.DB (raw D1 binding)
  -> bootstrap/database.ts: openDatabase(binding)
  -> bootstrap/d1-driver.ts: D1 binding + local SQL compiler
  -> new Database(driver), cached per binding with WeakMap
  -> createAppRouter({ db, config, sessionSecret, bound waitUntil }) per request
  -> native dependency middleware: context.db
  -> future model function(db: Database): query and business rules
  -> controller: call model, render/redirect
```

No application module reads env or imports `cloudflare:workers`. Database services
are reusable; request execution helpers and routers are not cached. No secrets,
bindings or database services are serialized into components. Existing fake models
and their shared state remain unchanged until the owner migrates them deliberately.

## Supported surface

- Single-table SELECT, DISTINCT, ordering, limit/offset, count and exists.
- Insert, homogeneous-column bulk insert, update and delete, including RETURNING.
- Basic comparison, NULL, BETWEEN, IN/NOT IN, LIKE/ILIKE and AND/OR predicates.
  Values use placeholders; identifiers are quoted independently.
- Raw parameterized SQL through `db.exec`, scripts through `db.executeScript`.
  Use raw SQL deliberately: the driver does not parse or police arbitrary SQL.
- Table/column existence checks. `close()` is a no-op because the runtime owns D1.
- Boolean values bind as 1/0. Typed `c.boolean()` reads become booleans; typed
  `c.json()` values write as JSON text and read as parsed JSON, including aliases
  and RETURNING. Null stays null. Invalid stored JSON throws.
- Raw reads retain SQLite storage values (integers/text); raw JSON parameters must
  be serialized by the caller. JSON predicates are not automatically serialized.
- Typed read results omit write metadata. Writes normalize D1's `meta.changes`;
  inserts expose returned primary keys when available, otherwise last_row_id for
  single-key tables. Raw SQL exposes rows and D1's change count.

Not implemented: upsert, joins, grouping/HAVING, savepoints, driver wipe, migration
locks, transaction hints or logical transaction tokens. Unsupported operations
throw. Bulk rows must supply identical column sets; multiple default-only rows
are rejected. Unsupported encodings (for example arbitrary objects outside JSON
columns) are left for D1 to reject. This is not a claim of complete data-table API
coverage or parity with the Node SQLite driver.

Capabilities: `returning: true`; `upsert`, `savepoints`, `transactionalDdl`, and
`migrationLock`: false. Even though raw SQLite ON CONFLICT works in D1, the driver
reports upsert false because it does not implement that query operation yet.

## Atomicity

Unlike Sergio's logical transaction scope, our `beginTransaction` throws before
`db.transaction` invokes its callback. Commit/rollback/savepoint methods also
throw; they never pretend to undo writes. Successful statements commit on D1.
One failed statement does not roll back earlier statements. Bulk insert is one
statement: a constraint failure leaves none of that statement's rows behind.
Do not split atomic business operations across independent model calls. Binding
`batch()` is not used and no claim is made about multi-statement script atomicity.

Node SQLite has real transactions and savepoints; passing SQLite tests cannot
prove D1 rollback behavior. Keep `npm run test:d1` as the runtime-specific check.

## Local configuration and migrations

`wrangler.jsonc` binds `DB`, names the local database `taqyeem`, and points to
`database/migrations`. There is deliberately no remote database_id: no resource
was provisioned and this configuration is not ready for deployment. Wrangler and
Vite use local persistent state under ignored `.wrangler/` by default.

```sh
npm run db:migration:create -- create_boards
npm run db:migrate:local
npm run db:migrations:list
npm run dev
```

Use zero-padded numbered forward-only `.sql` files. The directory currently has
no migrations and no application tables. Wrangler tracks applied files in
`d1_migrations`; the SQLite test helper replays the exact same SQL files into a
fresh in-memory database in filename order. It uses `executeScript`, not naive
semicolon splitting or Remix's different migration registry/journal format.
Foreign keys are enabled and failures close/discard the test database.

After separately approving/provisioning a remote database and configuring its ID,
the remote command is `npx wrangler d1 migrations apply DB --remote`. It has not
been run. Local migrations do not update a remote database. See Cloudflare's
[local development](https://developers.cloudflare.com/d1/best-practices/local-development/)
and [migration documentation](https://developers.cloudflare.com/d1/reference/migrations/).

The SESSION_SECRET fix on PR #33 declares `secrets.required` explicitly, so
`npm run types:worker` generates its type even without `.dev.vars`. Secret values
remain local/remote secret configuration, never config vars or generated types.

## Verification and learning handoff

- `npm test`: existing flows plus isolated migration replay and typed context SQL.
- `npm run test:d1`: separate test-only Worker, temporary isolated D1 state, two
  consecutive HTTP requests; no production smoke endpoint or application schema.
  Covers parameter binding with Arabic/SQL-looking text, CRUD/RETURNING, bulk
  atomicity, count/exists, predicates/pagination, boolean/JSON/null/alias encoding,
  metadata/introspection and explicit unsupported-operation rejection. The probe
  table is dropped and temporary state removed.
- `npm run typecheck`, `npm run build`, `remix doctor`.
- Local migration apply/list currently report no pending migrations.

Your first table/query work belongs in:

1. `database/migrations/0001_create_boards.sql`: define the physical table yourself.
2. `app/data/tables.ts` (new): matching `table()`/`column` declaration.
3. `app/models/boards.ts` or a new model module: functions accepting `Database`.
   The existing file currently defines fake-model contracts; evolve it deliberately.
4. `app/models/boards.test.ts` (new): `await createTestDatabase()` from
   `app/test/db.ts`, then `await db.close()` in finally.
5. Later, `app/middleware/models.ts`: bind your real model functions to context.db;
   keep controllers thin. This change intentionally does not perform that switch.

Small next exercise: define just a board id and title, apply the migration locally,
write a model function that inserts a board and one that finds it by id, and test
that an Arabic title round-trips in a fresh migrated database. Call those same
functions with `context.db` when you are ready to connect persistence to the UI.
