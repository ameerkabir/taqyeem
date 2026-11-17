# Implementation verification for #38

These checks exercise the Remix 3/Workers application, separately from the archived prototype evidence. The user approved implementation of the final candidate on 2026-11-16. No remote migration, deployment or production data conversion was performed.

## Automated boundaries

- `npm test`: 542 passing server tests in the final implementation run; complete server suite, including facilitator-only meeting reopening, competing/replayed requests, versioned archive immutability, real-closure migration preservation, rollback on archive failure, review GET isolation/future-step rejection and archive anonymity; appending notes to existing themes, board-scoped normalized theme-name uniqueness on create/rename, grouping concurrency/retries and native error preservation; category setup authorization/validation/concurrency/retries, empty-session migration and populated-board preservation; Collect-only SQL guards; membership/role/board isolation; competing commands and budget boundary; ballot close/reopen/staleness; retry deduplication; hidden ballots and anonymous hydrated data; explicit outcomes/no-action decisions; retained proposals; proposal editing; immutable agreement and later progress; durable sessions/fresh routers/expiry/tampering/key rotation; native appearance and error recovery.
- `npm run typecheck` and `npm run build`: application and browser bundle validation.
- `npm run test:d1`: isolated Miniflare D1, applying the actual numbered migrations with local Wrangler. Includes the existing adapter checks plus two real guided journeys with enforced category setup, atomic custom category replacement, persistent tones, idempotent confirmation and existing-theme append, evidence-preserving ungrouping, competing vote writes, stale ballot rejection, evidence snapshots, meeting reopen/reclose with two preserved records and fresh storage instances. It uses a disposable directory and does not contact production D1.
- `remix doctor --json`: environment/project/controller diagnostics. The existing `joinBoard` → `app/actions/join` naming warning is retained; it predates this change. The new edit-action controller follows the documented route directory convention.

## Browser checks

Run against the migrated **local** Worker. These scripts refuse non-localhost endpoints. They use an existing Playwright installation; no runtime or package dependency was added to the app. Set `PLAYWRIGHT_MODULE` to its `index.mjs` when Playwright is outside the repo, and `BROWSER_EXECUTABLE` when using an existing Chromium binary.

```sh
npm run db:migrate:local
npm run dev -- --host 127.0.0.1
# In a separate terminal, with the same supported Node version:
node test/guided-browser.mjs
node test/guided-editors.mjs
node test/guided-native.mjs
node test/category-setup-browser.mjs
node test/grouping-browser.mjs
node test/discussion-browser.mjs
node test/summary-browser.mjs
node test/reopen-browser.mjs
node test/guided-stress.mjs
```

Run the stress fixture separately: it seeds an explicitly labelled disposable board with local Wrangler SQL and must not run concurrently with other browser journeys. It is inspection data, not a way to repair or complete the continuous journey. Default output directories are `/tmp/taqyeem-guided-browser` and `/tmp/taqyeem-guided-stress`; `BROWSER_OUTPUT` can override them.

| Script | Actual evidence |
| --- | --- |
| `guided-browser.mjs` | Creates a board, joins a second identity, posts anonymous/mixed-script notes, retains an editor node and caret across unrelated updates, switches appearance/language without losing fields, simulates a lost response after server commit and retries without duplication, groups original evidence, votes with hidden totals, browses privately without shared changes, records an outcome/no-action decision, captures agreement and an unresolved participant suggestion, closes and verifies historical immutability after completion. Checks Summary bounds at all five widths. |
| `guided-editors.mjs` | Standalone and owned-note drafts across real language navigation; stable submission identity; newer typing during a slow save; actual mounted editor through a shared stage change; navigation between boards without state/draft leakage. |
| `guided-native.mjs` | Full 390px phone journey with JavaScript disabled: Create, note POST, category GET navigation, ballot, discussion, decision, agreed action, Summary and independent language/appearance native forms. |
| `category-setup-browser.mjs` | Facilitator classic/custom choice before note taking; participant waiting and automatic transition to the real configured board; custom labels and radio selection retained across theme/language changes; note posted into the confirmed custom categories; empty Collect bounds at five widths; native custom setup and editable validation recovery with JavaScript disabled. |
| `grouping-browser.mjs` | Enhanced desktop and native phone create/rename duplicate rejection with retained fields and selected notes; adding selected notes to an existing theme with a blank new title; stable theme identity, retained new-title draft, original source evidence and participant read-only view; Arabic/dark layout and subsequent progression to Vote. |
| `discussion-browser.mjs` | Enters Discuss through the real ballot/stage buttons and verifies the current headline and original feedback are visible immediately. Checks all source notes, independent browsing and return, shared changes reaching followers while private views stay put, facilitator-only sharing, retained mounted decision/action drafts and their topic across shared changes and preferences, native contextual decision/action POSTs targeting the viewed topic, Arabic/dark mode and five-width bounds including open editors. |
| `summary-browser.mjs` | Enhanced/native cases with 0, 1, 3 and 4 action/proposal records. Small Actions/Summary lists ignore stale filter URLs and show all items without filters or shown counts; larger lists retain native/enhanced filters and empty-result recovery. Verifies the visible decision recap, inspectable original agreements/suggestions, immutable closure after later completion, temporary print disclosure expansion/restoration and native print CSS, plus Arabic/dark small-list bounds at five widths. |
| `reopen-browser.mjs` | Enhanced/native past-step review GETs preserve the shared stage/revision and expose no editing; future steps stay unavailable. Closes, updates current progress, reopens as facilitator, revises and recloses to version 2, then checks unchanged read-only version 1 after another reopen and a fresh browser context. Covers participant controls, archived anonymous-author redaction, mounted draft text/node/topic retention in the enhanced path, dated-record selection and Arabic/dark history at five widths. |
| `guided-stress.mjs` | 240 inspections: six stages × five viewports × two languages × two themes × two roles. Actual fixture has 50 mixed 500-character notes, eight categories, 20 themes, 80 members and 30 proposals/actions. Checks bounds, active named category including category eight, real action filter counts/empty recovery, actual locale/theme and page errors. |

The viewports are 375×812, 390×844, 768×1024, 1280×800 and 1440×900. Core/browser/editor/native checks are completed journeys or targeted interactions; the 240 stress states are inspection coverage. These are not 240 completed meetings. The [application screenshots](screenshots/) include Home, desktop Collect/Actions, an Arabic phone draft and Arabic/dark Summary. The screenshots in this directory are application renders, unlike `../final/screenshots`, which preserve prototype provenance.

The category-setup follow-up adds classic/custom setup, a participant waiting screen, and a clearer empty Collect composition: compact board context, one prominent Add note action, colour markers and count badges, and purposeful empty lanes. New setup and empty-board screenshots are included alongside the completed-journey captures. Migration 0010 was applied to the local development D1 before these checks; branch checkouts need `npm run db:migrate:local` before starting the Worker.

The discussion follow-up replaces the three-column arrangement with a compact agenda and dominant topic/evidence area. **Now discussing** identifies the shared topic; private views retain the team’s actual topic in a banner. Related outcomes, decisions and actions remain attached to the viewed topic. Native capture links explicitly select their intended topic, and the two existing editors stay mounted for draft retention. The focused discussion journey, full two-identity journey, editor/native regressions and layout inspections run against the local Worker; this update requires no new database migration.

The small Summary refinement groups its meeting record header/tools, shows actual recap counts and separates original agreements in a disclosure from current action progress. Filters and shown/total counts appear only above three records in both Actions and Summary. Print emulation and before/afterprint events check that the disclosure keeps historical actions available and restores the reading state; this is not physical print/PDF pagination approval. No schema or shared command change is required.

The 2026-11-17 continuation adds recorded-meeting reopening and review navigation. Migration 0011 was applied to the local development D1 before browser checks. Its archive/closure/receipt guards preserve real earlier records and reject raw replacement or closure clearing; a fault-injected archive insert proves the single-statement transition rolls back. Reopening resumes Discuss with the latest working data, and each reclose saves a new immutable dated version. Completed-step links are read-only private views, not progression commands. Dated records are separately selectable and never display current-progress mutation controls. Branch checkouts need the numbered local migrations before serving this version; no remote migration or deployment was performed.

A parallel test attempt ran the local SQL stress seeder while other browser journeys were writing. Miniflare emitted an internal D1 session-commit-token error on one request. The fixture is now documented to run in isolation; the final journeys are rerun sequentially. This is not claimed as production load or multi-region testing.

## Font review

Alexandria (600–800) and Readex Pro (400–700) are self-hosted variable WOFF2 script subsets. The original SIL Open Font Licenses are included in `public/fonts/final`, with a source URL, byte count and SHA-256 manifest for each file. The OFL permits redistribution/bundling with its license; the family names and notices remain intact. No font binaries were modified or renamed internally. The total subset assets are approximately 200 KB; unicode ranges select the necessary scripts and `font-display: swap` provides fallbacks. There are no Google Fonts requests at runtime. The token-pair calculation in `token-contrast.json` gives minimum feedback body contrast 12.30:1 and metadata contrast 5.94:1; it does not cover every rendered state. This is a bounded asset-size/loading review, not a measured performance guarantee or native Arabic typographic approval.

## Outstanding release evidence

No production-readiness or complete accessibility certification is asserted. Human ownership for the remaining acceptance work is tracked under #50 with #24/#25:

- Native Arabic editorial/typographic review and real long-session comfort.
- Real iOS/Android keyboards, IME, screen readers and announcement/focus quality.
- Safari/Firefox, 200%/400% zoom and text-spacing review.
- Actual OS clipboard delivery, printed/PDF pagination and evidence readability.
- Actual separate devices, expired/lost-cookie recovery expectations, a real team meeting and pilot/security review.

Copy/print implementation preserves full evidence and awaits clipboard success, but an invoked print dialog or generated local PDF does not validate physical output. Browser storage does not recover cleared storage, a lost cookie, a different device or an unavailable tab. The first production transition from old memory-only sessions requires a supervised plan: their opaque cookie IDs cannot recover mappings already lost from Worker memory. The current polling transport does not establish online presence, availability or latency guarantees.
