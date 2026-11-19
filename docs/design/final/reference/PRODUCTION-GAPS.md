# Production gaps

This candidate is an isolated design prototype. It is not imported by the Worker, and its browser command checks demonstrate intended permissions rather than production security. This document records the production snapshot at worktree base `31a2e70`; unrelated changes in the original workspace were intentionally excluded.

## Existing production capabilities

The app uses Remix 3 explicit route maps and controllers, server rendering and literal-path `clientEntry()` browser components, running on Cloudflare Workers through Vite. D1 stores boards, members, categories, cards and card votes through `BoardModels` and the app's D1 driver. No UI library is required.

| Area | Existing behaviour | Candidate design gap |
|---|---|---|
| Create/invite/join | Persistent board creation, organiser membership, three default categories, `/boards/:boardId/join`, normalised unique names. Returning session members redirect to their board. Closed boards permit joining to read. | Additional invitation context and configurable voting budget require server data and validation. Prototype invitation URLs only address local prototype records. |
| Feedback | Persistent owned cards, anonymity flag, 500-character maximum, submission-id idempotency and rate limiting. | Candidate locks editing after Collect. Production locks edit/delete when closed or voting is open; new-card POST currently rejects closed boards. Align these policies deliberately before changing UI. |
| Stages | `collecting`, `meeting`, `closed`, `votingOpen`, `currentSectionId`. Closing also closes voting. | Six guided stages are proposed. Shared current topic and private browsing must be separate entities/state. A stored current section is not a discussion agenda. |
| Themes | Categories exist. | Themes, membership, rename/ungroup and evidence-preserving regrouping have no production models or APIs. |
| Votes | One removable vote per card/member. Totals computed from real rows; unique constraints make repeated vote requests idempotent. | Topic ballots, fixed board allowance, hidden aggregate results, ballot closure/reopening, readiness and deterministic ranking need authoritative rules and atomic enforcement. |
| Discussion | Section resolution favours valid requested section, then meeting's current section, then first category. | Explicit discussed/skipped/unaddressed outcomes, decisions and no-action records are proposed. Browsing must never implicitly record an outcome. |
| Actions and summary | Persistent closure and original cards exist. | Suggestions, disposition, agreed actions, owner/date, completion and historical decision snapshots have no production models/routes. Copy/print in the candidate do not create a durable server export. |
| Language | English/Arabic catalogues, locale cookie independent of membership, Accept-Language negotiation, Arabic fallback, Intl numbers/plurals and isolation helper. | New controls/messages need catalogue entries, Arabic editorial review and native-script typography validation. Prototype strings are not automatically production catalogue coverage. |

Evidence: `app/routes.ts`, `app/router.ts`, `app/data/{board,tables}.ts`, `app/models/{board-models,db-board-models}.ts`, `app/models/boards/{state,section}.ts`, `app/models/cards/{card,vote}.ts`, `app/actions/{card-access.tsx,join/controller.tsx,new-card/controller.tsx}`, `app/i18n/translator.ts` and `docs/decisions/0004-persistent-board-models.md`.

## Identity continuity and recovery

`app/sessions.ts` uses module-scoped `createMemorySessionStorage()`. Its signed HttpOnly cookie has a thirty-day maximum age, but the corresponding membership map is not durable across Worker isolate restarts or separate isolates. Persistent D1 rows alone therefore do not establish reliable returning organiser/member continuity. Production needs an explicit durable session/recovery decision before promising reliable reopening. Do not solve this by permitting identity recovery from a display name alone.

The original workspace's untracked `refresh-cards.tsx` is not part of this worktree and is not evidence of working realtime transport. No production refresh/presence guarantee was inferred from it.

## Shared versus viewer-local state

Future shared state: board identity/settings, members, original contributions, theme membership, ballot/version and votes, shared stage/live topic, explicit discussion outcomes, decisions, proposal disposition and action progress. Future viewer-local state: interface language/theme, draft text/category/anonymity, private topic selection, evidence expansion, filters and focus. Sharing a live topic must not replace a reader's deliberate private selection or active editor.

The candidate stores each board as localStorage JSON. Per-tab sessionStorage holds viewer identity, language/theme, private topic selection and drafts. Same-origin storage events refresh the working surface while a separate native dialog stays mounted. Commands reload the latest board, check role/stage/ownership and revalidate delayed operations at commit. These demonstrate intended behaviour, not atomic production concurrency or security. Reviewer identities and operation delays/failures are simulations.

An invitation identifies a stored board and opens Join in the same browser profile/origin, including another tab. A different device/profile or host/port has no copy of that local board; invitation URLs do not transfer its content. Clearing browser storage, private browsing and quota failures affect continuity. This is not cross-device durability or a production realtime service. See UX-DECISIONS and QA-REPORT for reviewer details and actual checks.

## Concurrency and real transport

A production service must order stage/ballot changes against pending commands, enforce budgets atomically, reject stale ballot versions, deduplicate retries and prevent two facilitators from overwriting membership/outcomes. D1's current driver rejects transactions; the existing architecture document requires statement-level invariants/constraints and explicit recovery. Browser last-writer storage is not an acceptable solution to these invariants.

Transport needs server revisions, authenticated authorisation, initial reconciliation, reconnect replay/deduplication, conflict handling, retry boundaries and visible pending/saved/failed status. Joined count is membership, not presence. No online count, latency, load, availability or security claim follows from the local prototype.

## Decision record versus later progress

Closure should preserve what was decided, which proposals were deferred/declined/unresolved, actual topic outcomes and original evidence. Later completion changes belong to action progress with timestamps/authorisation; they must not rewrite the meeting's historical agreement. Retention, export access and anonymous-author privacy require explicit production policy.

No production implementation, migration, database modification, deployment or dependency installation is authorised by this design phase.
