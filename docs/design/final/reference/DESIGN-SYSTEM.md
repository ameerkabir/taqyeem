# One working language

Taqyeem uses a quiet instrument ground and an emphatic typographic subject. Its identity lives in the working board: separate feedback cards, tactile controls, quiet topic surfaces, explicit selected states, and a visible relationship between source evidence and commitments. The mark is a short rail with a signal dot; it is not a participant identity system.

## Materials and roles
| Role | Light | Dark |
|---|---|---|
| Ground | #E7E6E0 | #121215 |
| Surface | #FCFBF8 | #1D1D22 |
| Ink | #17171B | #F2F1EC |
| Secondary | #55545E | #B3B2BC |
| Primary next move | #FF5A1F, dark ink | #FF6A2E, dark ink |
| Selection / focus | #17171B | #F2F1EC |
| Selected card surface | #FFF2E9 | #35271E |
| Boundaries | #7B7A83 | #797884 |

Orange is used with verb labels for progress. Selected ballots use an ink outline, warm neutral surface, an inverted button, a check, explicit “Selected — remove”, and aria-pressed. Live/private and proposal dispositions have text labels. Ownership is “Yours”, not an orange stripe. No state depends solely on colour. Boundary contrast was strengthened after independent review; computed token ratios are in qa/contrast.json.

## Type and rhythm
Alexandria 600–800 for short display headings; Readex Pro 400–700 for controls and working content. Both cover Arabic and Latin. Google Fonts are prototype-only external requests; self-host/subset after approval. Browser checks exercise both scripts; font network availability may affect fallback rendering. Native Arabic typography/microcopy approval remains outstanding.

Desktop display caps at 67px on Home, 48px on stage headings and 46px on discussion subjects. Phone subjects are 27px, body 14px; desktop body 15px. Arabic removes negative tracking and uses 1.85 body leading and 1.5 display leading versus 1.65 and 1.25 in English. No arbitrary uppercase metadata. Working notes preserve whitespace and use dir=auto; bdi isolates inline mixed content. Interface digits and dates use Intl with the selected locale. Count labels use count-plus-noun constructions rather than conjugated sentence plurals.

Spacing follows a practical 4/8 rhythm with 12/16/20/24/30/40 steps. Body measures cap at 74ch; discussion heading at 28ch. Each contribution is a discrete card, separated by space instead of shared row rules. Categories are unboxed lanes. Theme cards name their source evidence; vote cards separate title, evidence preview, inspection and voting. Actions are individual cards in a two-column desktop grid and a single phone column; summary topics also have their own surfaces. Discussion keeps evidence and action cards in adjacent areas without a shared outer container. Controls use 9px radii, surfaces 13–14px, sheets 18px. Buttons have a small tactile 2px lip, without decorative floating machinery.

## Navigation and responsive composition
Six named stages form a noninteractive progress rail. Shared progression belongs to the facilitator; reviewer stage inspection is explicitly separate. Entry screens have a single reading path. Join follows Neo’s compact invitation composition: facilitator sentence, dominant title, limited initial stack with actual joined count, labelled stage pill, name, short contextual privacy hint and a full-width Join button. Additional anonymity detail is an optional disclosure, preserving the honest privacy explanation without overwhelming entry. Avatar initials are decorative context, never presence indicators or the only representation of a member. Desktop discussion has agenda, dominant subject, evidence and adjacent actions; desktop navigation is normal flow after independent review found dock overlap. Phone discussion removes the duplicate rail/meeting preamble, keeps compact topic position and a full-title agenda dialog, starts with two notes and offers Show all. Private browsing never changes shared live topic or outcomes. Previous/next and Add/Suggest use a reachable sticky dock; stage advance is separate below it. Empty discussion retains its header advance control.

Phones show one readable category with an always-labelled native picker. Standard desktop boards show 3–4 readable lanes. More than four categories use shelves of three selected by the complete category picker; extra categories are not buried after the tallest lane. Phone Group starts on selectable notes with Notes/Themes buttons; switching preserves selection, and a compact selection dock appears only after selecting a note. Desktop Group keeps a two-column card pool beside themes, with category filtering and explicit theme membership on notes. Actions have a disposition/owner/execution filter and owner entry uses native searchable datalist suggestions for large teams.

## Interaction and accessibility
46–48px controls are an ergonomic aim, not a blanket WCAG certification. Visible 3px focus outline with 4px offset; native modal dialogs provide inert background and focus containment. Closing a draft preserves work, explicit Discard confirms destruction. Editors stay outside the main rendering root. Failed submission shows an associated error and leaves every field intact. Empty Enter inserts a line; only Ctrl/Cmd+Enter submits and ignores composition events.

150ms colour/shadow changes explain control response; there is no choreographed feed animation. Reduced motion removes transitions. No surprise automatic agenda movement during private reading/editing. Status messages use a live region without replacing the editor. Copy success awaits the clipboard promise. Print requests are described as requests, not verified PDFs.

## User-led card refinement
The user rejected the initial article-like row treatment and saturated blue. This revision supersedes that visual direction: ink, warm neutrals and orange are the core palette; separate contributions remain visually separate across all working screens. Home now shows two note cards and one neutral action card, rather than a blue action block inside a tilted panel. CSS refinements live in `refinement.css`; state/command rules remain unchanged.

## Soft category backdrops
At the user’s request, Collect now uses low-chroma category backgrounds: mint `#E0EEE5`, peach `#F7E4D7`, cyan `#DCEEF0` and lilac `#E9E3F1`. Neutral cards stay separate inside the softly rounded lanes. Dark counterparts are `#1B2B25`, `#33261F`, `#1B2B31` and `#2A2434`. A category keeps the same tone across shelves, interface language and viewport; eight categories cycle the four tones. Names/counts remain the navigation and identification mechanism. These tints are category context, not selection, ownership, live state or voting results. Orange remains the functional primary accent. On phones, the labelled category picker shares the active lane’s tone.

## Actions workspace
Actions has a direct stage title and one supporting sentence, with actual agreed/awaiting-review counts. A single toolbar contains the labelled native filter and Add/Suggest action; both controls are 48px high and share the same top and bottom edges, including on phones and in RTL. The filter includes real counts. The result heading names the selected view and exposes its shown/total count accessibly. Cards stretch to the same row height with footer controls aligned; read-only cards omit empty control footers. A filtered empty state occupies an intentional quiet surface, explains the absence of matching records and offers Show all actions. A genuinely empty board offers capture-or-close guidance without requiring a manufactured action.

## Final colour placement decision
After a controlled browser comparison, colour moves from enclosing category lanes to individual Collect cards. The preceding backdrop section describes the prior iteration. Collect now has a warm-white canvas (`#FCFBF8`) and paler note surfaces: mint `#EAF3EC`, peach `#F9ECE3`, cyan `#E7F3F3`, lilac `#F0EBF3`. Dark card colours are `#1C2624`, `#2B2320`, `#1C262C`, `#25222E` on the existing dark ground. Lanes are transparent, while the sticky picker stays opaque. Geometry and behaviour are retained. Other stages retain neutral cards. See `CARD-COLOUR-REVIEW.md` for the balanced critique, actual rendered comparison and trade-offs.

## Collect controls, reduced
Collect no longer has a black bottom dock. Desktop Add note sits in a sticky board toolbar beside the category picker. On phones the same single Add note control becomes a compact 48px labelled floating button; there is no full-width containing strip. Optional readiness is a quiet underlined “Done writing” button beside the collection controls, with aria-pressed and a reversible checked state. It neither submits drafts nor progresses the meeting. The aggregate says “done writing”, not ambiguous “ready”. Focus scroll padding accounts for the sticky toolbar.

## Category identity across the session
Original feedback cards now keep their exact category tint wherever rendered: Collect, Group pool/theme inspection, voting evidence, Discuss, Summary and selected-note review dialogs. The category is stamped on each card, rather than inherited solely from its Collect lane. Individual-note ballot cards also keep that tint; themes and actions remain neutral because they can relate to several categories. Group selection retains the category surface and adds an ink outline/check/button state. The Home specimen uses the same feedback colours. All light working-board stages now share the warm-white canvas; Home/Create/Join retain the Neo entry ground.

The first and fourth tints were too close to neutral. Revised light values: green `#E3F1DE`, peach `#FAE7DA`, cyan `#E0F0F5`, lavender `#EEE1F5`. Dark values: `#203024`, `#33251E`, `#1B2D36`, `#30243B`. The green is more clearly green and the lavender more clearly purple; labels remain essential for colour-vision differences and repeated tones at eight categories.

## Landing-page note wall
Home now previews all four feedback categories using the same `.note` component classes, tone attributes, borders, type, metadata and palette as the working board. Four upright cards form a two-column wall on desktop/tablet and one column on phones; a neutral agreed-action example sits below. Home shares the warm-white light canvas with the board. The preview is explicitly labelled as an example and has no simulated presence or clickable fake controls. Sample note/action bodies remain in their original script when the interface changes. The Create call to action stays early in the reading order and visible in the checked initial viewports.
