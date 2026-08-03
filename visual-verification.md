# Visual Verification Notes

## Desktop checks

- `/catalogue` renders the new deferred **Minimum price**, **Maximum price**, and **Minimum land size** fields inside the existing Apply/Reset filter panel. The land placeholder clearly accepts `2 acres` or `8,000 sqm`, and the controls align with the existing responsive filter hierarchy.
- `/niche/dev_site` renders the same three deferred filters, explanatory 500-acre text, populated property cards, and the existing sign-up gate without overlap.
- Accessible niche cards expose a clear `View analysis` affordance and the navigation handler successfully opened `/property/750041` for 305 Union Road, North Albury.
- `/property/750041` is tagged **Development Sites** and **Positive Geared**. The page renders the universal NSW Planning Portal section first, followed by separate development-site and positive-geared investment-analysis sections. Missing FSR, height, and frontage values are shown as `Not captured` rather than inferred.
- The desktop detail layout has a clear hero summary, category chips, two-column content hierarchy, and readable planning-data cards without clipping at 1280px width.

Further checks will cover a subdivision-plus-development listing, the remaining niche analyses, and mobile breakpoints.

## Preview capture results

| Route | Desktop result | Mobile result |
|---|---|---|
| `/catalogue` | Price inputs and the free-text land-size field sit within the established filter card, and the results grid remains aligned. | Filter controls stack into one readable column, Apply/Reset remain reachable, and listing cards flow vertically without horizontal overflow. |
| `/niche/dev_site` | The three-field deferred filter panel, sorting controls, property grid, and pagination retain clear hierarchy. | The fields stack cleanly above full-width cards; images, metadata, and `View analysis` remain readable. |
| `/property/750041` | The NSW Planning Portal grid is the first left-column analysis, with development and yield sections below and contextual details in the sidebar. | Hero summary cells, actions, category chips, planning cards, analysis metrics, and sidebar cards all collapse into a single readable column without clipping. |

The real listing check also confirmed that a multi-category property renders more than one investment-analysis section while planning data remains universally available and especially prominent for development-site screening.

## Additional category checks

The `/niche/deceased_estate` page loaded 14 active listings with the same deferred price and flexible land-size controls. The populated card grid preserved consistent metadata hierarchy, exposed `View analysis` on each accessible card, and retained the existing free sign-up gate. Representative listings visibly included explicit estate wording, auction campaigns, and one property also marked subdividable, providing suitable real-data cases for detail-section validation.

The representative deceased-estate card opened `/property/181245` for 263 Lyons Road, Russell Lea. Its detail page leads with a dedicated **Deceased estate opportunity screen** showing the stored category indicator, 10-day campaign timing, asking-price text, active suburb median context, and six active local comparables. Because the listing has no parsed numeric asking price, the page correctly shows `POA` instead of inventing a discount percentage. The universal NSW planning grid follows with stored E1 zoning, 10 m frontage, site area, and explicit availability states for every mapped control and risk field.

The multi-tag check used `/property/750017` for 207 Dumaresq Street, Armidale, which is dual-income, development-site, and subdividable. On both desktop and mobile, the NSW Planning Portal grid remains the first analysis block and clearly shows R1 zoning, a 500 m² minimum lot size, 4,899 m² site area, and explicit uncaptured states. It is followed by separate development-site, dual-income/granny-flat, and subdivision sections. The subdivision screen correctly shows a stored score of 97, nine-lot yield, and a 9.8× land-to-minimum-lot ratio; the non-numeric auction price correctly prevents fabricated rent and price-per-lot calculations. The mobile page keeps all three analyses legible in a single column without horizontal overflow.

The `/niche/distressed` page loaded 115 active listings with the same deferred filter controls, readable property cards, and the unchanged free sign-up gate. The accessible results include numeric asking prices and varied campaign ages, providing valid stored-data cases for urgency and active-market discount screening. The first listing card for 15 Salen Street, Maclean was selected for the detailed distressed-analysis check.

That card opened `/property/720103`, a listing tagged distressed and positive geared. The page shows the universal planning grid plus separate yield and **Distressed / mortgagee opportunity** sections. The distressed screen clearly presents the stored category signal, a fresh one-day campaign indicator, $685,000 asking price, active Maclean median comparison, six active comparables, and an explicit `Not captured` state explaining that historical price changes are not stored. The mobile capture preserves the complete hierarchy, warning notes, comparables list, and analysis cards without horizontal overflow.

Together, the real-data checks cover subdivision, positive-geared, deceased-estate, dual-income/granny-flat, development-site, and distressed/mortgagee analysis variants on desktop and mobile.
