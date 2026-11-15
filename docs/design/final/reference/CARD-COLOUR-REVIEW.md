# Card or column colour — material decision

## Decision
Use pale category-tinted feedback cards on a warm-white Collect canvas, with unboxed lanes. Retain the current card shape, borders, spacing, labels and hierarchy. Use corresponding dark tints. Preserve the category tint on original feedback wherever it is inspected, while keeping mixed-category themes and action cards neutral. This continuity refinement follows subsequent user review; the initial material decision had kept later evidence neutral. The previous version was credible; this is a better match for the product’s emphasis on individual contributions and the user’s explicit objection to enclosing containers.

## What was actually compared
Browser-rendered versions of the same 34-note and 50-note/eight-category fixtures, at 390 and 1280, English and Arabic, light and dark. Two controlled material variants kept the same geometry: current tinted columns/neutral cards versus existing tints transferred to cards on a warm-white canvas. Top-of-board and mid-reading screenshots were inspected. The second treatment was then softened: pale card tints approximately two-thirds the original column intensity, with exact palette values for stable reproduction. This was a surface study, not a new concept competition or observed usability study.

Evidence: `qa/colour-study-*-lanes-*` and `qa/colour-study-*-cards-*`; refined sample `qa/colour-study-soft-*`. `qa/card-colour-study.mjs` explicitly recreates both original comparison materials even after the candidate changes. The first trial’s neutral phone picker was accidentally transparent and let scrolled text show through; this was an experimental CSS defect, corrected to an opaque canvas-coloured picker before the final comparison. It is not evidence against coloured cards.

## Critique
| Consideration | Tinted columns, neutral cards | Pale cards, warm-white canvas |
|---|---|---|
| Individual voices | Cards are distinct, but each belongs visually to one larger pastel container. | Each coloured surface belongs to one contribution; clearer object identity. |
| Category organisation | Strong, continuous region from header through every note; strongest advantage. | Alignment, category headings, named picker and note metadata carry structure; colour reinforces rather than supplies it. |
| Crowded board | Quiet reading surfaces, but large coloured panels make the wall feel enclosed and layered. | White gutters open the wall; full-strength card fills become too repetitive with long notes, hence the paler final fills. |
| Phone | Tint surrounds a stack of neutral cards and repeats on the picker; feels like a container inside the page. | One stack of independent notes on a continuous canvas. No simultaneous categories means tint adds character more than navigation. |
| Reading | Neutral paper is the quieter starting point. | Pale fills remain readable in tested screenshots; do not claim proven comfort for a long meeting. Body/metadata contrast is measured separately. |
| State semantics | Category regions do not compete with note ownership. | Risk of a coloured card looking selected or “yours”; explicit ownership text and existing non-colour selection affordances must remain. |
| Later stages | Region colour naturally stops when the column disappears. | Carry each original note’s colour into its evidence views, while leaving the enclosing theme/action neutral so a mixed topic is not assigned an arbitrary category. |

The recommendation is not based on improved density: geometry was held constant and this is not a way to show more notes. Nor is it a new category-discovery feature: every name was already present. It is a composition improvement—more emphasis on each contribution and less enclosing apparatus. The trade-off is greater colour directly behind text and a weaker continuous category region. Pale fills, strong labels, whitespace and restrained borders make that trade-off acceptable here.

## Final material
Canvas: warm white `#FCFBF8`, rather than pure white. Cards: green `#E3F1DE`, peach `#FAE7DA`, cyan `#E0F0F5`, lavender `#EEE1F5`. Dark canvas remains `#121215`; card tints are `#203024`, `#33251E`, `#1B2D36`, `#30243B`. Category identity remains stable across shelves/language/viewport; repeated tones at eight categories do not replace labels. The picker stays opaque when sticky. Orange remains the primary action colour, and semantic state rules are unchanged.

## Verification and limits
`qa/column-colours.mjs` now checks the implemented pale-card material at all five target viewports, both roles/scripts/themes; `qa/card-material-contrast.mjs` measures actual body/metadata colours against every stress category’s card surface. The comparison’s own axe/bounds results are in `qa/card-colour-study-results.json`. Automated checks establish technical constraints, not preference or long-session comfort. No real meeting, physical-device, screen-reader or native Arabic validation is claimed. No board data, prototype command rules, original concept or production source was changed by this decision.

Subsequent continuity review: all working-stage light canvases now use warm white, while Home/Create/Join retain their Neo ground. First/fourth hues were strengthened after the user found the initial pale mint/lilac too similar. See `qa/category-palette-four-lanes-*` and the continuity checks for current evidence; initial comparison screenshots remain historical.
