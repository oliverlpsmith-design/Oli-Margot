# Visual Verification: 100-Acre Default and Discovery Methodology

Verified against the managed development preview on 1 August 2026 at desktop (1440 × 900) and mobile (390 × 844) breakpoints.

| Surface | Verified result |
|---|---|
| Homepage `/` | The concise “How Investor Scout finds opportunities” section appears after the six investment-category cards. Its three-step layout stacks cleanly on mobile and does not duplicate or obscure the primary calls to action. |
| Subdivision `/niche/subdivision` | The minimum-land field visibly starts at `100 acres`, displays the `404,700 sqm · 100 acres` conversion, and explains that the value can be changed or cleared. The collapsed “How We Find These” trigger is prominent above the search and filter controls. |
| Positive geared `/niche/pos_geared` | The category-specific methodology trigger appears between the category header and deferred filter panel with consistent spacing. |
| Deceased estates `/niche/deceased_estate` | The methodology trigger is visible above filters and listing cards on desktop and mobile without horizontal overflow. |
| Dual income `/niche/dual_income` | The methodology trigger and filter panel stack cleanly at the mobile breakpoint. |
| Development sites `/niche/dev_site` | The methodology trigger remains compact above a populated four-column desktop catalogue and one-column mobile catalogue. |
| Distressed `/niche/distressed` | The methodology trigger is visible and aligned consistently with the other niche pages across both breakpoints. |
| Watchlist `/watchlist` | A persistent “Browse 100+ acre subdivision” header action appears even outside the empty-state panel; the empty-state action also returns to subdivision browsing. Both controls remain readable and correctly stacked on mobile. |

No clipping, horizontal overflow, inaccessible colour contrast, or filter-panel overlap was observed in the captured desktop or mobile layouts.

## Expanded disclosure check

The subdivision disclosure was opened interactively in the managed preview. The expanded state rendered the planning inputs, restricted-zone screen, 2.00/1.80 lot-yield thresholds, complete 0–100 score breakdown, and three limitations in a readable two-column desktop grid. The accordion trigger remained keyboard-addressable, the chevron changed state, and the expansion pushed the catalogue controls downward without overlaying or clipping them.
