# QLD UI validation — 3 August 2026

## Desktop preview

Validated the live development preview at 1280 × 900 after the QLD implementation.

- The catalogue exposes a deferred **NSW + QLD** state selector alongside region and zoning filters.
- State selection does not trigger RealtyAPI calls; the catalogue continues to query the stored database only when **Apply filters** is used.
- The homepage now states NSW and Queensland coverage and lists QLD Globe, State Planning Policy mapping, and validated council services in the source disclosure.
- The subdivision catalogue description now covers both states and explicitly states that unavailable QLD council controls remain subject to manual review.
- The shared footer discloses that QLD council-rule coverage is partial and that unknown fields remain marked for manual review.
- The development preview was authenticated as the project owner, so the admin-only incremental scan and CSV export controls were visible as expected; backend authorization tests are required to verify they remain unavailable to regular users.
- Layout, text contrast, selector spacing, listing grid, and footer rendered without visible overflow or clipping at the tested desktop viewport.

## Remaining validation

- State-aware router, saved-search, export authorization, and zone-option tests.
- Full Vitest, type-check, and production build.

## Mobile preview

Validated `/catalogue` at 390 × 844. The state, region, category, score, age, price, practicality, zoning, recency, search, view-mode, and Apply controls stack within the mobile viewport without horizontal clipping. Listing cards collapse to a single readable column and preserve the footer disclosure. The state selector remains part of the deferred filter form rather than creating a separate live-search interaction.
