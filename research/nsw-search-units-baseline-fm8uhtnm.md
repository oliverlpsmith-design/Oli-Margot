# NSW RealtyAPI Search-Unit Baseline

This artifact freezes the current `shared/regions.ts` search fan-out before QLD is added. The expected baseline is **12 region groups and 34 RealtyAPI location strings**. QLD implementation tests must assert that these IDs, labels, location strings, ordering, and fan-out counts remain unchanged unless a separately approved NSW correction is made.

| Ordinal | Region ID | Region label | RealtyAPI location string |
|---:|---|---|---|
| 1 | `greater-sydney` | Greater Sydney | `Western Sydney, NSW` |
| 2 | `greater-sydney` | Greater Sydney | `Eastern Suburbs, NSW` |
| 3 | `greater-sydney` | Greater Sydney | `Inner West, NSW` |
| 4 | `greater-sydney` | Greater Sydney | `Northern Beaches, NSW` |
| 5 | `greater-sydney` | Greater Sydney | `Sutherland Shire, NSW` |
| 6 | `greater-sydney` | Greater Sydney | `Macarthur, NSW` |
| 7 | `greater-sydney` | Greater Sydney | `Hawkesbury, NSW` |
| 8 | `central-coast` | Central Coast | `Central Coast, NSW` |
| 9 | `hunter-valley` | Hunter Valley & Newcastle | `Hunter Valley, NSW` |
| 10 | `hunter-valley` | Hunter Valley & Newcastle | `Newcastle, NSW, 2300` |
| 11 | `mid-north-coast` | Mid North Coast | `Mid North Coast, NSW` |
| 12 | `northern-rivers` | Northern Rivers | `Northern Rivers, NSW` |
| 13 | `illawarra-south-coast` | Illawarra & South Coast | `Illawarra, NSW` |
| 14 | `southern-highlands` | Southern Highlands | `Southern Highlands, NSW` |
| 15 | `blue-mountains` | Blue Mountains | `Blue Mountains, NSW` |
| 16 | `central-west` | Central West | `Orange, NSW, 2800` |
| 17 | `central-west` | Central West | `Bathurst, NSW, 2795` |
| 18 | `central-west` | Central West | `Dubbo, NSW, 2830` |
| 19 | `central-west` | Central West | `Mudgee, NSW, 2850` |
| 20 | `central-west` | Central West | `Parkes, NSW, 2870` |
| 21 | `central-west` | Central West | `Cowra, NSW, 2794` |
| 22 | `central-west` | Central West | `Lithgow, NSW, 2790` |
| 23 | `central-west` | Central West | `Forbes, NSW, 2871` |
| 24 | `central-west` | Central West | `Wellington, NSW, 2820` |
| 25 | `new-england` | New England & North West | `Tamworth, NSW, 2340` |
| 26 | `new-england` | New England & North West | `Armidale, NSW, 2350` |
| 27 | `new-england` | New England & North West | `Moree, NSW, 2400` |
| 28 | `new-england` | New England & North West | `Gunnedah, NSW, 2380` |
| 29 | `new-england` | New England & North West | `Inverell, NSW, 2360` |
| 30 | `new-england` | New England & North West | `Narrabri, NSW, 2390` |
| 31 | `new-england` | New England & North West | `Glen Innes, NSW, 2370` |
| 32 | `new-england` | New England & North West | `Tenterfield, NSW, 2372` |
| 33 | `riverina` | Riverina | `Riverina, NSW` |
| 34 | `far-west` | Far West | `Far West, NSW` |

## Fan-out assertions

| Region ID | Expected location count |
|---|---:|
| `greater-sydney` | 7 |
| `central-coast` | 1 |
| `hunter-valley` | 2 |
| `mid-north-coast` | 1 |
| `northern-rivers` | 1 |
| `illawarra-south-coast` | 1 |
| `southern-highlands` | 1 |
| `blue-mountains` | 1 |
| `central-west` | 9 |
| `new-england` | 8 |
| `riverina` | 1 |
| `far-west` | 1 |
| **Total** | **34** |

## Required implementation regression

Before release, add an automated test that imports the final state-aware registry and asserts: NSW has 12 region groups; NSW has 34 enabled scan units; the flattened ordered `(regionId, location)` pairs match this table; and every NSW unit carries `state: "NSW"` after the registry is generalized.
