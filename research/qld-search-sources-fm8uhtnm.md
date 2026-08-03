# QLD Search-Unit Research Sources

## Authoritative coverage frameworks discovered

The Queensland Government regional-planning page states that Queensland is organized into regional planning areas and lists the current regional plans. The government’s May 2026 regional-planning article states that 13 regional plans are in place or under review and collectively cover Queensland. These regions are useful as human-readable catalogue groupings, but they are not yet verified as RealtyAPI-recognized location strings.

- Queensland Planning — Regional planning: https://www.planning.qld.gov.au/planning-framework/plan-making/regional-planning
- Queensland State Development — “Planning ahead: How regional plans support thriving Queensland communities”: https://www.statedevelopment.qld.gov.au/news-and-events/planning-ahead-how-regional-plans-support-thriving-queensland-communities,-and-how-you-can-be-involved-in-shaping-yours

Queensland Government sources report 77 local governments, while the Queensland Government Statistician’s Office ASGS 2021 page exposes 78 statistical LGA map areas. The difference must be reconciled before using LGAs as search units; neither count should be copied uncritically into the application.

- Department of Local Government, Water and Volunteers — Local Government Directory: https://www.dlgwv.qld.gov.au/local-government/for-the-community/local-government-directory
- Electoral Commission of Queensland — Local government area boundaries: https://www.ecq.qld.gov.au/electoral-boundaries/local-government-area-boundaries
- Queensland Government Statistician’s Office — Queensland local government areas (LGA), 2021: https://www.qgso.qld.gov.au/visualisations-geographies/geographical-boundaries/queensland-local-government-areas-lga-2021

The Queensland open-data portal publishes the official spatial representation of LGA boundaries in SHP, TAB, FGDB, KMZ, and GPKG formats. This dataset is the preferred machine-readable authority for completeness and deduplication checks if LGA-based search coverage is adopted.

- Queensland Open Data — Local government area boundaries: https://www.data.qld.gov.au/dataset/local-government-area-boundaries-queensland
- Queensland State Development — Local government area boundaries PDF: https://www.statedevelopment.qld.gov.au/__data/assets/pdf_file/0019/42454/local-government-area-boundaries.pdf

## Current research status

The authoritative frameworks above define geographic completeness but do **not** prove that RealtyAPI accepts their names as `/search/bylocation` inputs. Every proposed RealtyAPI location string still requires validation against the live API, including checks that it resolves to QLD inventory rather than silently falling back to an Australia-wide result. The final registry must use stable internal unit IDs and may group many verified city/town/locality strings under broader Queensland regions.

## Verified Queensland regional-plan names

The current Queensland Planning page lists **13** regional plans or planning areas: Cape York; Central Queensland; Central West; Darling Downs; Far North Queensland; Gulf; Mackay, Isaac and Whitsunday; Maranoa-Balonne; North Queensland; North West; South East Queensland; South West; and Wide Bay Burnett. These names provide a defensible grouping taxonomy for Investor Scout, but their suitability as RealtyAPI query strings remains unproven.

## Verified QGSO statistical LGA inventory

The Queensland Government Statistician’s Office ASGS 2021 page states that its maps are mesh-block approximations for statistical purposes and lists **78** areas. The names are: Aurukun, Balonne, Banana, Barcaldine, Barcoo, Blackall-Tambo, Boulia, Brisbane, Bulloo, Bundaberg, Burdekin, Burke, Cairns, Carpentaria, Cassowary Coast, Central Highlands, Charters Towers, Cherbourg, Cloncurry, Cook, Croydon, Diamantina, Doomadgee, Douglas, Etheridge, Flinders, Fraser Coast, Gladstone, Gold Coast, Goondiwindi, Gympie, Hinchinbrook, Hope Vale, Ipswich, Isaac, Kowanyama, Livingstone, Lockhart River, Lockyer Valley, Logan, Longreach, Mackay, Mapoon, Maranoa, Mareeba, McKinlay, Moreton Bay, Mornington, Mount Isa, Murweh, Napranum, Noosa, North Burnett, Northern Peninsula Area, Palm Island, Paroo, Pormpuraaw, Quilpie, Redland, Richmond, Rockhampton, Scenic Rim, Somerset, South Burnett, Southern Downs, Sunshine Coast, Tablelands, Toowoomba, Torres, Torres Strait Island, Townsville, Weipa, Western Downs, Whitsunday, Winton, Woorabinda, Wujal Wujal, and Yarrabah.

The Local Government Directory separately states that Queensland has **77 local governments**. The statistical inventory therefore cannot be treated as a one-for-one council list without reconciliation. The application does not need to issue 77 or 78 RealtyAPI queries nightly merely because those areas exist; it needs a verified set of search strings that provides practical statewide listing coverage with controlled request volume.

## realestate.com.au provider-native region evidence

The rendered “Regions in QLD” tab on realestate.com.au’s Queensland results page exposes provider-native location names that differ materially from Queensland Government planning-region names. Source: https://www.realestate.com.au/rent/in-qld/list-1 (rendered 3 August 2026).

The first visible portion of that tab included: `Brisbane - Eastern Region`; `Boonah - Greater Region`; `Canungra Region`; `Kawana Waters`; `Yeppoon, Capricorn Coast - Region`; `Weipa Town`; `Fraser Island`; `Taroom - Greater Region`; `Goondiwindi - Greater Region`; `Mary Valley Region`; `Rockhampton - Greater Region`; `Sunshine Coast`; `Northern Queensland - Region`; `Ipswich - Greater Region`; `Woodford - Greater Region`; `Kuranda - Greater Region`; `Darling Downs`; `Mount Isa - Greater Region`; `Surat Basin`; `Mareeba - Greater Region`; `Maleny - Greater Region`; `Whitsunday Islands`; `Noosa Hinterland`; `Beaudesert Region`; `Gympie - Greater Region`; `Redland City Region`; `Western Queensland - Region`; `Charters Towers`; `Bundaberg - Greater Region`; `Kingaroy - Greater Region`; `Far North Queensland`; `Logan City - Region`; `Maryborough - Greater Region`; `Buderim Region`; `Noosa`; and `Atherton - Greater Region`.

The remainder of the rendered list added: `Biloela - Greater Region`; `Southern Region`; `Moura - Greater Region`; `Somerset Region`; `Magnetic Island`; `Cairns - Greater Region`; `Brisbane - Inner City Region`; `Gold Coast`; `Stanthorpe - Greater Region`; `North Stradbroke Island`; `Moreton Bay Region`; `Mission Beach - Greater Region`; `Tully - Greater Region`; `Brisbane - Southern Region`; `Blackall Range`; `Mackay - Greater Region`; `Central Queensland - Region`; `Lockyer Valley Region`; `Toowoomba - Greater Region`; `Brisbane - Greater Region`; `Bribie Island - Greater Region`; `Hervey Bay - Greater Region`; `Toowoomba City and Suburbs`; `Whitsundays - Greater Region`; `Discovery Coast, Agnes Water - Region`; `Gladstone - Greater Region`; `Port Douglas - Greater Region`; `Moreton Island`; `Warwick City & Suburbs`; `Samford - Greater Region`; `Charters Towers - Greater Region`; `Ayr - Greater Region`; `Warwick - Greater Region`; `Sunshine Coast, Hinterland - Region`; `Gold Coast Hinterland - Region`; `Childers - Greater Region`; `Bayside Region`; `Baffle Creek - Greater Region`; `Innisfail - Greater Region`; `Brisbane - Northern Region`; `Dayboro - Greater Region`; `Townsville - Greater Region`; `Ipswich City and Suburbs`; `Gin Gin - Greater Region`; `Scenic Rim Region`; and `Brisbane - Western Region`.

This captured rendered inventory is **not itself the final scan registry**. It confirms that provider-native regions are often finer-grained and frequently overlap broader regions. The final registry must therefore validate listing membership and deduplication before combining broad regions with nested subregions, and it must not assume that the website’s popular-region links are exhaustive for every remote LGA.
