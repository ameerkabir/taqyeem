# Final candidate implementation handoff

This is the reviewable entry gate for [#38](https://github.com/ameerkabir/taqyeem/issues/38) and [#39](https://github.com/ameerkabir/taqyeem/issues/39). **Design signoff is pending. No application implementation or release acceptance is claimed.** The implementation branch and PR were explicitly requested; deployment and remote migrations were not.

The original candidate lives on `design/final-candidate` in the local `taqyeem-final` worktree. Its six design documents are preserved verbatim in [reference](reference/), with selected existing screenshots in [screenshots](screenshots/). [manifest.json](manifest.json) records their source paths and SHA-256 digests. These are prototype evidence, not screenshots or test results of the Worker application. The prototype engine, presets, reviewer identities, local storage and simulation code are not shipped.

## Reconciled contract

This section resolves the iteration history in the reference documents. For implementation, the issue contract and this section take precedence over earlier material descriptions. Preserve the historical documents rather than silently rewriting evidence.

- Use Alexandria for short expressive headings and Readex Pro for body and controls in both scripts. Font licensing, self-hosting and performance review remain required before introducing assets; prototype Google Fonts requests are not a production decision.
- All light working stages and Home use warm white `#FCFBF8`, ink `#17171B`, orange primary actions. Dark ground is `#121215`. Entry-screen density may differ without introducing another visual language.
- Feedback surfaces are green `#E3F1DE`, peach `#FAE7DA`, cyan `#E0F0F5`, lavender `#EEE1F5`; dark counterparts are `#203024`, `#33251E`, `#1B2D36`, `#30243B`. Earlier lane fills, neutral feedback rows and other palette values in the history are superseded.
- Category tint belongs to each original note through every stage and evidence dialog, including an individual-note ballot. Category identity must be persisted independently of display order and translation. Repeating four tones for many categories is permitted; labels remain essential. Mixed-category themes and actions stay neutral.
- Contributions are separate compact cards with subtle boundaries. Selection, ownership, readiness and live state use explicit structure and labels. No saturated blue selection blocks, violet branding, character art or fabricated operational claims.
- Home shows four category examples and a neutral action, labelled as examples. Create asks for title/facilitator name and real settings only. Join follows facilitator, dominant board title, actual membership/stage context, name, honest privacy copy and one Join control.
- Desktop Collect uses 3–4 readable lanes with shelves/picker at eight categories. Phones show one labelled category and one note column. One Add note control sits in the sticky desktop toolbar or compact reachable phone position. Optional Done writing is reversible and does not post or progress the session.
- The mounted composer follows category, multiline note, anonymity, Post. Preserve all fields, focus and selection through unrelated updates, dismissal, preferences, failure/retry and stage changes. Honour 500 characters, `dir="auto"`, IME, newline Enter, reduced motion, native forms and idempotency.
- Voting needs explicit allowance, separate evidence and vote controls, independent readiness, truthful save state and recovery when all votes are used. Hide aggregate results until an authoritative ballot close.
- Discussion separates private browsing from the shared live topic. Desktop keeps agenda, subject, evidence and capture adjacent. Phones start with two notes and Show all, full-title agenda and reachable navigation. Navigation never implies an outcome or interrupts reading/editing.
- Actions use neutral cards, truthful counts, labelled filters, aligned 48px filter/Add controls, desktop footer alignment, one phone column and Show all recovery. Owner search must use actual members.
- One interface language at a time: English LTR or natural Arabic RTL. Localise interface values while preserving contribution text and viewer identity, drafts, preferences and meaningful navigation state.

## Domain and authority review

The intended journey is Collect → Group → Vote → Discuss → Actions → Summary. Feedback → theme → discussion → decision → action describes relationships, not a requirement to manufacture records.

The following policies need explicit design/domain signoff at this gate and authoritative implementation with concurrency tests: Collect-only owned editing; at most one theme per note; optional grouping; themes plus ungrouped notes as topics; one vote/topic/member with configurable approved budget; explicit close/reopen and stale-command rejection; no silent active-ballot regrouping; deterministic original-order ties and zero-vote topics; explicit discussed/skipped/unaddressed outcomes; decisions without actions; proposal disposition separate from agreed-action execution; unresolved proposals surviving closure; immutable historical agreement independent of later progress.

Only facilitators change shared progression. Viewer drafts, language/theme, filters, private topic, reading expansion and focus are local preferences. A signed cookie backed by module memory does not provide durable identity across Workers. D1's current adapter does not support multi-statement transactions. Neither limitation can be replaced by prototype storage or client checks.

## Current main and delivery dependencies

Revalidated against `origin/main` at `08f07585789ca38420abf51c07fe63f53896c466`. The prototype documents describe base `31a2e70`; the subsequent main merge does not add the proposed domain capabilities. Production still has collecting/meeting/closed, card votes, `current_section_id` and module-scoped memory session storage. Current editing permits owned changes outside closed/voting-open periods; adopting Collect-only edits is a policy change, not a CSS change.

| Sequence | Ownership | Concrete completion evidence |
| --- | --- | --- |
| Entry gate | #39 | Reconciled handoff, bounded continuous-journey review and explicit signoff; this PR only prepares the handoff |
| Data foundations | #54, #56 | Restart-safe membership/recovery; populated legacy migration and stable category identities |
| Shared visual system | #40, #41 | Tokens/type/licensing; appearance persistence without viewer or draft loss |
| Existing-capability adoption | #42–#45 | Responsive Collect, Home, real Create/Join and mounted editors backed by current commands |
| Shared domain | #47, #52, #53 | Six-stage authorised commands, themes, versioned ballots; constraints and competing-request tests |
| Dependent workspaces | #46, #20, #22, #55, #49, #23 | Real voting/discussion/decision/action/history and export journey |
| Transport/recovery | #3, #16, #17 | Authenticated revision-aware updates, reconnect/replay and draft-safe reconciliation |
| Acceptance | #50 with #24/#25 | Integrated bilingual multiuser evidence; separate release authority |

Visual slices can adopt existing board/member/card data only after the entry gate. Readiness, full stages, themes, topic budgets/ballot closure, discussion outcomes, decisions, proposals/actions and immutable history remain gated on server capabilities. Do not display those as functional controls before their commands exist. Optional #48/#51 are outside core delivery.

## Outstanding evidence

The archived QA describes local prototype Chrome checks. No check in that report proves application accessibility, durability, real transport or production readiness. This handoff has not rerun those historical scripts or performed the bounded continuous-journey consistency review; #39 remains open.

| Required acceptance | Owner / evidence required |
| --- | --- |
| Bilingual composition and microcopy | #39/#50: native Arabic reviewer approval with findings and resolution |
| Physical keyboards and focus | #45/#50: real iOS/Android, IME, Enter/newline, caret and draft retention |
| Assistive technology and browsers | #50: screen readers, Safari/Firefox, modal/status announcements and keyboard navigation |
| Readability | #50: 200%/400% zoom, text spacing and long-session review |
| Shared journey and identity | #54/#16/#17/#50: actual separate devices, restart/reconnect, overlapping commands and a real session |
| Export | #23/#50: actual copy/print/PDF output, full evidence and historical accuracy |

Acceptance covers 375×812, 390×844, 768×1024, 1280×800 and 1440×900; both scripts/roles/themes; 50 notes, 500-character/mixed text, eight categories, 20 themes, 80 members and 30 actions. Missing evidence, data loss, inaccessible navigation and broken continuous journeys block release signoff. Named human reviewers and pilot participants still need assignment; ticket ownership here is not evidence that those reviews happened.
