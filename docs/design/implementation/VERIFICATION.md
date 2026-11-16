# Implementation verification for #38

These checks exercise the Remix 3/Workers application, separately from the archived prototype evidence. The user approved implementation of the final candidate on 2026-11-16. No remote migration, deployment or production data conversion was performed.

## Automated boundaries

- `npm test`: 529 passing server tests in the final implementation run; complete server suite, including populated legacy migration preservation; Collect-only SQL guards; membership/role/board isolation; competing commands and budget boundary; ballot close/reopen/staleness; retry deduplication; hidden ballots and anonymous hydrated data; explicit outcomes/no-action decisions; retained proposals; proposal editing; immutable closure and later progress; durable sessions/fresh routers/expiry/tampering/key rotation; native appearance and error recovery.
- `npm run typecheck` and `npm run build`: application and browser bundle validation.
- `npm run test:d1`: isolated Miniflare D1, applying the actual numbered migrations with local Wrangler. Includes the existing adapter checks plus two real guided journeys with competing vote writes, stale closure rejection, evidence snapshots and fresh storage instances. It uses a disposable directory and does not contact production D1.
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
node test/guided-stress.mjs
```

Run the stress fixture separately: it seeds an explicitly labelled disposable board with local Wrangler SQL and must not run concurrently with other browser journeys. It is inspection data, not a way to repair or complete the continuous journey. Default output directories are `/tmp/taqyeem-guided-browser` and `/tmp/taqyeem-guided-stress`; `BROWSER_OUTPUT` can override them.

| Script | Actual evidence |
| --- | --- |
| `guided-browser.mjs` | Creates a board, joins a second identity, posts anonymous/mixed-script notes, retains an editor node and caret across unrelated updates, switches appearance/language without losing fields, simulates a lost response after server commit and retries without duplication, groups original evidence, votes with hidden totals, browses privately without shared changes, records an outcome/no-action decision, captures agreement and an unresolved participant suggestion, closes and verifies historical immutability after completion. Checks Summary bounds at all five widths. |
| `guided-editors.mjs` | Standalone and owned-note drafts across real language navigation; stable submission identity; newer typing during a slow save; actual mounted editor through a shared stage change; navigation between boards without state/draft leakage. |
| `guided-native.mjs` | Full 390px phone journey with JavaScript disabled: Create, note POST, category GET navigation, ballot, discussion, decision, agreed action, Summary and independent language/appearance native forms. |
| `guided-stress.mjs` | 240 inspections: six stages × five viewports × two languages × two themes × two roles. Actual fixture has 50 mixed 500-character notes, eight categories, 20 themes, 80 members and 30 proposals/actions. Checks bounds, active named category including category eight, real action filter counts/empty recovery, actual locale/theme and page errors. |

The viewports are 375×812, 390×844, 768×1024, 1280×800 and 1440×900. Core/browser/editor/native checks are completed journeys or targeted interactions; the 240 stress states are inspection coverage. These are not 240 completed meetings. The [application screenshots](screenshots/) include Home, desktop Collect/Actions, an Arabic phone draft and Arabic/dark Summary. The screenshots in this directory are application renders, unlike `../final/screenshots`, which preserve prototype provenance.

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
