# Investor Scout QLD Search-Unit Design

## Decision status

This is a **research proposal only**. No production search registry, scan behavior, database schema, or UI has been changed. The proposed registry is intended for the implementation checkpoint after QLD planning-source research is complete.

## Geographic completeness basis

Queensland Government sources distinguish **77 local governments** from the Queensland Government Statistician’s Office list of **78 statistical LGA map areas**. The extra statistical area is Weipa Town Authority, which is not one of the 77 councils. The machine-checkable proposal assigns each of the 77 councils exactly once and records Weipa as a service area.[1][2]

The proposed catalogue groups councils into **15 user-facing QLD regions** and uses **17 provider-native RealtyAPI search strings**. This is deliberately smaller than 77 nightly queries because RealtyAPI/realestate.com.au exposes broad regional units that cover multiple councils. All query strings were tested against the live RealtyAPI `/search/bylocation` endpoint with `channel=buy`, the production viable property types, newest-first ordering, and page 1.

| Measure | Result |
|---|---:|
| Queensland local governments mapped | 77 of 77 |
| Duplicate council assignments | 0 |
| User-facing QLD region groups | 15 |
| Primary RealtyAPI search units | 17 |
| QLD viable listings reported by statewide query | 34,674 |
| Sum of primary-unit totals | 33,424 |
| Newest statewide listings tested | 30 |
| Newest statewide listings present in a primary unit | 30 of 30 |
| Pairwise primary-unit overlaps on tested first pages | 1 listing |

The 17-unit primary registry is supplemented by a **statewide newest-first incremental safety net** using `Queensland`. It should run first during warm incremental scans and stop after two all-known pages. It should **not** be used for the historical backfill because the statewide result set is too large and could hit pagination limits before older remote listings are reached. The safety net catches new remote listings that provider-region boundaries may omit or change.

## Proposed QLD region and search-unit registry

| Stable group ID | Catalogue label | RealtyAPI search unit(s) | Council coverage strategy |
|---|---|---|---|
| `qld-brisbane` | Brisbane | `Brisbane - Greater Region, QLD` | Brisbane |
| `qld-gold-coast` | Gold Coast | `Gold Coast, QLD` | Gold Coast |
| `qld-sunshine-coast` | Sunshine Coast and Noosa | `Sunshine Coast, QLD` | Sunshine Coast, Noosa |
| `qld-moreton-bay` | Moreton Bay | `Moreton Bay Region, QLD` | Moreton Bay |
| `qld-ipswich` | Ipswich | `Ipswich - Greater Region, QLD` | Ipswich |
| `qld-logan` | Logan | `Logan City - Region, QLD` | Logan |
| `qld-redlands` | Redlands | `Redland City Region, QLD` | Redland |
| `qld-scenic-rim` | Scenic Rim | `Scenic Rim Region, QLD` | Scenic Rim |
| `qld-somerset` | Somerset | `Somerset Region, QLD` | Somerset |
| `qld-lockyer-valley` | Lockyer Valley | `Lockyer Valley Region, QLD` | Lockyer Valley |
| `qld-darling-downs` | Darling Downs and South West | `Darling Downs, QLD` | Toowoomba, Southern Downs, Western Downs, Goondiwindi, Maranoa, Balonne |
| `qld-wide-bay-burnett` | Wide Bay Burnett | `Bundaberg - Greater Region, QLD`; `Hervey Bay - Greater Region, QLD`; `Gympie - Greater Region, QLD` | Bundaberg, Fraser Coast, Gympie, North Burnett, South Burnett, Cherbourg |
| `qld-central` | Central Queensland and Mackay-Whitsunday | `Central Queensland - Region, QLD` | Banana, Central Highlands, Gladstone, Livingstone, Rockhampton, Woorabinda, Isaac, Mackay, Whitsunday |
| `qld-northern` | North, Far North and Cape York | `Northern Queensland - Region, QLD` | 25 councils from Burdekin and Townsville through Cairns, Cape York and Torres Strait; Weipa recorded as a service area |
| `qld-western` | Western and North West Queensland | `Western Queensland - Region, QLD` | 20 western, gulf and north-west councils |

The exact 77-council assignment, stable search-unit IDs, live totals, and safety-net configuration are stored in `research/qld-search-unit-proposal-fm8uhtnm.json`. Validation confirms 77 mapped councils, 77 unique councils, no duplicate assignments, 15 groups, and 17 primary units.

## RealtyAPI request-volume model

The existing sweep performs one `/search/bylocation` request per page and normally one `/details/byid` request for each newly discovered listing. Known listing IDs are touched but not re-analysed. The production sweep’s safety cap is 250 pages per unit and its warm incremental stop is two consecutive all-known pages.

| QLD workload | Search requests | Detail requests | Interpretation |
|---|---:|---:|---|
| One-time primary historical backfill | approximately 1,122 | up to approximately 34,674 unique listings | Expected total is approximately 35,796 RealtyAPI requests before deduplication savings; this fits within the 85,000-request plan but should be staged and resumable. |
| Warm incremental QLD scan, completed daily | approximately 36/day | only genuinely new listing IDs | 17 primary units plus one statewide safety unit, two all-known pages each. |
| Warm incremental QLD search traffic, 30 days | approximately 1,080/month | variable | Search traffic alone is modest; new-listing details are the main variable. |
| Sold/off-market reconciliation | 0 search | maximum 150/day under the current callback design | Maximum approximately 4,500 detail checks per 30 days if the nightly callback runs once daily. |

Across NSW and QLD, the warm two-page search baseline is approximately **3,120 search requests per 30 days**: 34 existing NSW units plus 18 QLD units, multiplied by two pages and 30 days. The 85,000-request allowance therefore remains dominated by listing-detail requests, not location searches.

Implementation should add a persisted monthly request ledger and a server-side budget threshold before the QLD backfill. A conservative rollout is: complete the QLD regional backfill in resumable slices; activate the statewide safety net only after the primary QLD backfill; keep the existing known-ID deduplication; and pause non-essential sold checks or manual scans before the monthly allowance is exhausted. Regular users must not receive any procedure that triggers this work.

## Validation limitations and safeguards

First-page matching validates **recency coverage**, not perfect historical set equality. Provider-region boundaries are undocumented and can change. The statewide incremental safety net is therefore a deliberate completeness control, while the 17 primary units provide practical backfill depth and catalogue grouping.

The initial live probes consumed **149 bounded RealtyAPI autocomplete/search requests**: 42 exploratory autocomplete queries, 30 first-page search comparisons, and 77 council autocomplete checks. Raw research responses are stored outside the deployed project under `/home/ubuntu/qld_research/`; the production code contains no credentials or probe scripts.

## Sources

[1]: https://www.dlgwv.qld.gov.au/local-government/for-the-community/local-government-directory "Queensland Department of Local Government — Local Government Directory"
[2]: https://www.qgso.qld.gov.au/visualisations-geographies/geographical-boundaries/queensland-local-government-areas-lga-2021 "Queensland Government Statistician’s Office — Queensland local government areas, 2021"
[3]: https://www.data.qld.gov.au/dataset/local-government-area-boundaries-queensland "Queensland Open Data — Local government area boundaries"
[4]: https://www.realestate.com.au/rent/in-qld/list-1 "realestate.com.au — rendered Regions in QLD navigation used to identify provider-native region labels"
