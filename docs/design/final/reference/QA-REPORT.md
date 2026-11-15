# Latest follow-up: landing note wall

Home now mirrors the working note style: four category-tinted cards using the shared note classes and colour tokens, warm-white canvas, real-sized body/metadata typography and one neutral example action. The preview is labelled as an example board; original-script sample bodies do not change with interface language. On phones the cards are one column, with a deliberate gap after Create.

`qa/home-note-style.mjs` / `home-note-style-results.json` covers 20 Home states across all five requested viewports, both scripts/themes. It checks four distinct colours against the actual board's feedback cards, visible/navigable Create, one-column phone layout, board-state retention under preference changes, axe and bounds. No violations or checked overflow were observed. Lead-inspected screenshots are `home-notes-*` (desktop English light, phone English light, plus final Arabic/dark samples). This is local browser verification; prior real-device/screen-reader/native-speaker limitations remain.

---

# Latest follow-up: colour continuity across the session

Original notes now carry their own category tint through Collect, Group (including selection/theme inspection), voting evidence, Discuss, Summary, selected-note dialogs and the Home specimen. Single-note ballots also use their source colour. Multi-category themes/actions remain neutral; the shared light working-board canvas is warm white. The green/purple separation is stronger without increasing every category to a saturated fill. Current palette evidence: `category-palette-four-lanes-light.png` and `category-palette-four-lanes-dark.png`; these reviewer-only captures include one added Shout-outs note to show all four tones.

`qa/feedback-colour-continuity.mjs` / `feedback-colour-continuity-results.json` compares actual computed card backgrounds by original note ID across four later stages, phone/desktop, both scripts/themes, including selected states and ungrouped-note ballots; all 32 stage/material cases pass with zero axe violations. Source disclosures are opened. The final run also asserts the shared light working-stage canvas. Updated measured minimum body contrast is 12.30:1 and metadata 5.94:1. The continuous journey passes again. Labels continue to identify categories; these checks are not colour-vision or native-speaker validation.

---

# Latest follow-up: reduced Collect controls

The oversized black Collect dock is removed. One Add note control lives in the sticky desktop toolbar and becomes a compact labelled phone button. “Done writing” is a quiet reversible self-report, separate from posting and shared progression. `qa/collect-controls.mjs` / `collect-controls-results.json` verifies one Add control, no dock, no submission or stage change from readiness, reversibility, draft retention and phone reachability. Lead screenshots: `collect-controls-1280-en.png` and `collect-controls-390-ar.png`. The continuous journey passed again, and the existing 40-state Collect axe/bounds check covers the revised controls. Sticky toolbar focus clearance has explicit scroll padding.

---

# Latest review: card versus column colour

The comparison and resulting decision are recorded in `CARD-COLOUR-REVIEW.md`. `qa/card-colour-study.mjs` compares two materials with identical geometry using 34-note and 50-note/eight-category boards at 390/1280, English/Arabic, light/dark, with top and mid-reading screenshots. Both treatments pass the comparison’s axe and bounds checks; this does not establish which is aesthetically preferable. The final material uses paler tinted cards on a warm-white Collect canvas. `qa/column-colours.mjs` checks the implemented material at all five target viewports, roles/scripts/themes, and `qa/card-material-contrast.json` records actual card-text ratios: minimum body 13.61:1, metadata 6.35:1 across the eight stress categories in light/dark. No behaviour/data change required a new journey implementation.

The lead inspected current/alternative desktop top and reading views, phone reading views, Arabic stress boards and refined light/dark card samples. Preference and long-session comfort remain design judgements, not conclusions from axe. Current `columns-*` screenshots supersede their earlier lane-colour names. Earlier report entries remain iteration history.

---

# Latest follow-up: Actions toolbar

The Actions page now uses a direct heading, supporting sentence and actual agreed/awaiting-review totals. The labelled filter and Add/Suggest action have matching 48px heights and top/bottom edges. Filter options include counts; the result heading shows the active view. No-match views now have a specific empty state and Show all actions recovery, while genuinely empty boards retain a capture-or-close path. Desktop card footers align by row. Phone facilitator context and Close meeting share a compact row.

`qa/actions-refinement.mjs` / `actions-refinement-results.json` covers populated and deferred-empty views across the five viewports, both roles/scripts/themes. The checks measure control bounds, check filter focus and reset recovery, axe/bounds and action draft retention. Current captures use `actions-toolbar-`; `actions-preview-*` records the lead's inspected desktop populated/empty and phone Arabic layouts. The continuous journey was rerun successfully. An initial focus assertion was a harness mistake: Playwright selectOption does not itself focus the control. The check now explicitly focuses it before simulating a change and verifies that focus survives rendering.

---

# Latest follow-up: category colour

Collect now uses soft mint, peach, cyan and lilac lane backgrounds, with neutral separate note cards and corresponding dark tints. `qa/column-colours.mjs` / `column-colours-results.json` is the targeted evidence: 40 Collect states across all five viewports, both scripts/themes and both roles, plus stable tone assignment for all eight stress categories. Screenshots use `columns-`; the lead inspected desktop light, desktop Arabic dark and phone Arabic light results. This supersedes the transparent-lane appearance in earlier evidence.

The check found a reviewer URL issue: an explicit organiser role did not restore the facilitator after visiting as a participant. Startup role handling now honours both explicit role values, and the 40-state check asserts actual viewer identity. Earlier matrix role labels recorded requested roles rather than asserting them; do not treat that earlier run as proof of every actual role combination. The continuous journey separately exercises distinct facilitator/participant identities against the same model.

---

# Current card revision verification

User feedback identified a visual/product weakness despite passing earlier technical checks: contributions read as continuous articles, the blue was unwanted, Join lacked the preferred Neo composition, and phone Group opened on themes rather than the task of selecting notes. Those judgements supersede the initial row-based design conclusion. This revision changes the candidate itself, not only its documentation.

Current evidence: `qa/refinement-checks.mjs` / `refinement-results.json` and `qa/refined-*.png` cover 64 card-based Home, Join, Collect, Group, Vote, Discuss, Actions and Summary states at 390/1280, English/Arabic, light/dark. The lead visually inspected phone Arabic Collect, phone English Group, desktop Join/Home/Vote/Discuss/Actions and phone Arabic dark Summary, then refined the implementation. Phone Group pane switching preserves selection; every card and unboxed lane check passes; no saturated blue surface or page error was observed. Stage exits clear selection styling. Rerendering also restores ordinary button/picker focus by stable selector, while dialog inputs remain mounted.

The continuous journey, edge, clipboard/print, dialog and contrast checks were rerun after the card revision. The full 360-state matrix was also rerun for the revised layout; consult current JSON rather than inferring accessibility from the earlier run. The separate independent reviewer report below describes the preceding iteration; it is not claimed as an independent evaluation of this card revision. Technical checks support review, not automatic design approval. Production boundaries and unverified physical-device/screen-reader/native-Arabic conditions remain unchanged.

---

# Final candidate verification

## Scope and decision
One isolated Neo-led candidate, reviewed in Chrome using emulated viewports. The continuous core journey passed; no known data-loss, missing-source-evidence, inaccessible-category or broken-core-journey failure remains in the checked paths. This supports a design review, not an automatic approval or production release. Native Arabic review, assistive-technology testing and a real meeting remain approval evidence still to gather. Production implementation is not authorised.

## Executable evidence
- `qa/checks.mjs` → `results.json`: ten bundled checks pass, including a newly created board from Home through Summary without preset recovery, distinct joined participant, anonymous editing, failure/retry, grouping, voting closure races and trustworthy outcomes. Empty/stress tests are separately labelled and use reviewer tooling.
- `qa/edge-checks.mjs` → `edge-results.json`: five checks pass for modal focus, exhausted allowance/redistribution, regroup lock, eight categories/long text, immutable closure history and unavailable invitation.
- `qa/export-checks.mjs` → `export-results.json`: three checks pass for rejected/awaited clipboard promises and print invocation/evidence visibility. Clipboard API was stubbed; OS clipboard delivery and PDF output were not verified.
- `qa/modal-checks.mjs` → `modal-results.json`: eight note/action dialog scans across languages/themes, no axe violations; stage changes retain the active draft and correctly reject late posting.
- `qa/contrast.mjs` → `contrast.json`: eleven foreground/boundary pairs meet their 4.5:1 text or 3:1 boundary thresholds. Not a proof of every possible rendered combination.
- `qa/matrix.mjs` → `matrix.json`: 360 inspection states, nine screens × five viewports × two languages × two roles × two themes. Final run: zero axe violations and zero out-of-bounds checked elements. See JSON for per-state results. This is inspection coverage, not 360 completed journeys.
- `qa/lab-checks.mjs` → `lab-results.json`: candidate registration, five-way comparison and all seven original concept paths pass with no page errors.
- `qa/independent-review.md`: separate reviewer inspected populated Collect, Vote, Discuss and Actions in 32 script/theme/phone/desktop states, then rechecked the candidate refinements.

| Viewport | EN/AR | Facilitator/participant | Light/dark | Coverage |
|---|---|---|---|---|
| 375×812 | both | both | both | All nine inspection screens; targeted editor/evidence checks |
| 390×844 | both | both | both | All nine; independent populated working-screen review |
| 768×1024 | both | both | both | All nine inspection screens |
| 1280×800 | both | both | both | All nine; independent review and continuous journey |
| 1440×900 | both | both | both | All nine inspection screens |

Bounds checks inspect actual rendered headings/content/controls against the viewport. Scoped stage-rail scrolling is deliberate and keyboard-focusable. No overflow-hiding rule conceals unreachable elements. Stable screenshot files include independent-* and stage-width-language-theme captures. Font loading depends on Google Fonts; both scripts were observed rendered, without native-speaker validation.

## Required regression mapping
| Requirement | Evidence |
|---|---|
| 1 Draft survives unrelated update/expiry | checks draft test; independent textarea identity/caret check |
| 2 Language/theme retain committed content and draft | checks draft/anonymous tests; independent review |
| 3 Retry retains text, no duplication | checks failed note; edge focus retry |
| 4 Create/invitation identifies correct board | checks new board/invitation |
| 5 Distinct identities, same model | checks participant tab and permission rejection |
| 6 Every category named/discoverable | checks stress; edge all eight shelves |
| 7 Anonymous edit, no false contribution signal | checks anonymous test; no named participation inference exists |
| 8 Group/ungroup preserve notes | checks grouping |
| 9 Vote/remove/redistribute/allowance | checks voting; edge all-used/sixth rejection |
| 10 Close with in-flight mutation | checks delayed participant vote; independent model test |
| 11 Browse without outcomes/shared change | checks discussion; independent private browsing |
| 12 All source evidence | checks phone disclosure; desktop ballot/discussion disclosures; independent inspection |
| 13 Empty discussion forward path | checks empty board |
| 14 Pending proposals retained | checks closure and independent model test |
| 15 Summary matches recorded state | checks decision/discussed/suggested/history; export checks |
| 16 Continuous journey without preset repair | first eight checks from created board; presets only in separate stress/empty tests |

## Demonstrated defects corrected
Legacy source findings: editor destruction/draft reversion, role-triggered reseeding, broken invitation addressing, navigation-as-discussion, fabricated voter counts and pending-proposal deletion are replaced by explicit candidate state/command rules. Existing Neo density/single-composer refinements were preserved, not claimed as new fixes.

Candidate review corrected: excessive phone discussion preamble (topic y285 → about y133 at 390 EN); desktop dock overlapping outcomes; eight-category burial; detached modal focus restoration after external render and after submit; insufficient field-border contrast; nonfocusable stage-rail scrolling; collapsed notes hidden in print. Final targeted checks verify focus and print fixes. The first race-test failure was a non-bubbling harness event, not a product defect. First strict-selector/source-count failures were harness assumptions corrected to visible controls and the actual live topic.

## Remaining limitations and risks
No known blocking defect in the verified paths. Do not equate this with full WCAG 2.2 AA approval. Chrome’s native datalist ownership search needs Safari/Firefox and screen-reader review. Modal names/containment and keyboard paths were checked, but screen-reader announcement quality is unverified. Touch targets generally use 46–48px controls; this is an ergonomic aim distinct from WCAG AA minimums. Keyboard viewport handling is emulation/code-based, not physical-device proof.

The local store does not provide atomic multi-tab transactions, production security, server durability, authentic identity or cross-device transport. Slow/offline/reconnect are labelled simulations. Concurrent truly simultaneous writes can overwrite each other; they require production transactions/version checks. Drafts are per tab and editor type, not cross-device recovery. External storage deletion cannot be recovered. Browser quota failure is not a full recovery workflow. A 45-minute team session, native Arabic copy/typography, real iOS/Android keyboards, screen readers, 200%/400% zoom, Firefox/Safari, actual clipboard integration and PDF pagination remain unverified.

Production tests/typecheck were not run because no production source or dependency changed. Source preservation compared every original Lab file except authorised registration files byte-for-byte: no original concept/fixture/review changed. Original workspace changes were not copied into the worktree, committed or modified.
