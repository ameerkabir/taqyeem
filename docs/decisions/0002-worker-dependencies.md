# Worker application dependencies (#32)

`server.ts` is the runtime boundary. `createRequestOptions` narrows generated
`Cloudflare.Env` bindings into the hand-written `AppRouterOptions` contract and
binds `ctx.waitUntil` to its originating execution context. Neither raw env nor
ExecutionContext enters `app/`. No runtime import of `cloudflare:workers` is needed,
so tests can supply ordinary objects and functions.

```text
Worker fetch(request, env, ctx)
  -> createRequestOptions(env, ctx): config, secret, bound waitUntil
  -> fresh createAppRouter(options)
  -> cop / render / dependency middleware / session / models
  -> controller -> request models -> shared in-memory board store
  -> Response (session middleware signs the cookie)
```

The dependency middleware uses native `createContextKey` and `context.set` to
publish `context.config` and `context.waitUntil`. Its tuple context transform
records that both values are present. The secret is used only to configure session
signing, not published in context. Dependencies are never passed into component
props. `router.fetch(request, init)` accepts RequestInit, not application context.

## Lifetimes

- Router and bound execution helper: one incoming request. Never cache a router
  holding this helper or the entire ExecutionContext.
- Config and cookie/session middleware: constructed with the router; existing
  cookie name, signing, expiry and security attributes remain unchanged.
- Session storage (`app/sessions.ts`) and default board store
  (`app/models/fake-boards.ts`): module scope, shared across routers in an isolate.
  They remain volatile and are neither durable nor shared between isolates.
- Models: constructed for each request, resolving identity from that request's
  session, with the deliberate demo-only fallback preserved.

There is currently no background job consumer; waitUntil is available to future
server actions without exposing the rest of the runtime. APP_ENV is passed through
unchanged (including the existing configured spelling); no UI changes are needed.
Tests with custom router stacks now provide the same typed dependencies as the app.

## Generated bindings

Run `npm run types:worker` after binding/config changes. The generated
`worker-configuration.d.ts` describes raw bindings, not application dependencies.
Runtime declarations continue to come from the installed
`@cloudflare/workers-types`; generation uses `--include-runtime=false` to avoid a
second runtime declaration set, and `--strict-vars=false` permits environment
values to differ. Wrangler declares SESSION_SECRET through `secrets.required` in config, so
type generation works without local `.dev.vars`; generated types contain no secret values. Deployment must supply the
secret separately. The Worker still rejects an empty secret.

## Database follow-up (#2)

> Done: see `0004-persistent-board-models.md`. The text below is the original plan.

Construct a `remix/data-table` Database around a D1 DatabaseDriver adapter at the
Worker/bootstrap boundary and inject the constructed Database through options and
middleware. Cache only suitable database services around stable bindings, never
request helpers. Models take Database and own queries/business rules; controllers
call models. Do not add a generic repository layer.

The current [Uptime reference](https://github.com/sergiodxa/monorepo/tree/0a0ab2412c89ffc0756ba27477e528ea831f5ca1/apps/uptime)
was rechecked for this work: main still resolves to that commit. Inspected worker,
database/router initializers, model middleware, database-middleware implementation,
and data-table-d1 README/manifest. It creates a router per fetch and caches a
Database; its database initializer imports `cloudflare:workers`. Taqyeem keeps raw
runtime access at a narrower bootstrap boundary.

The adapter manifest requires Remix 3.2.0; Taqyeem has 3.1.0 installed. #2 must
select and pin an exact compatible adapter release, verify driver capabilities and
transaction semantics, or explicitly decide on another driver. The adapter README
describes D1 transactions as a scope with immediately committed statements, so
multi-statement rollback must not be assumed. This work installs no adapter and
adds no DB/R2 bindings, schema, persistence migration, joining, or realtime.
