/**
 * RealtyAPI search scope catalogue.
 * Every entry maps a human-readable scope to provider-native location strings
 * that were validated against RealtyAPI. State-wide scans fan out across all
 * enabled regions for that state and deduplicate listings by provider id.
 */

export type SearchScopeType = "suburb" | "region" | "state";
export type CoveredState = "NSW" | "QLD";

export interface RegionDef {
  id: string;
  label: string;
  state: CoveredState;
  /** RealtyAPI location strings queried (fan-out) for this region. */
  locations: string[];
  /** QLD councils assigned to this search group; informational, not a planning entitlement. */
  lgas?: string[];
  enabled?: boolean;
}

export const NSW_REGIONS: RegionDef[] = [
  {
    id: "greater-sydney",
    label: "Greater Sydney",
    state: "NSW",
    locations: [
      "Western Sydney, NSW",
      "Eastern Suburbs, NSW",
      "Inner West, NSW",
      "Northern Beaches, NSW",
      "Sutherland Shire, NSW",
      "Macarthur, NSW",
      "Hawkesbury, NSW",
    ],
  },
  { id: "central-coast", label: "Central Coast", state: "NSW", locations: ["Central Coast, NSW"] },
  { id: "hunter-valley", label: "Hunter Valley & Newcastle", state: "NSW", locations: ["Hunter Valley, NSW", "Newcastle, NSW, 2300"] },
  { id: "mid-north-coast", label: "Mid North Coast", state: "NSW", locations: ["Mid North Coast, NSW"] },
  { id: "northern-rivers", label: "Northern Rivers", state: "NSW", locations: ["Northern Rivers, NSW"] },
  { id: "illawarra-south-coast", label: "Illawarra & South Coast", state: "NSW", locations: ["Illawarra, NSW"] },
  { id: "southern-highlands", label: "Southern Highlands", state: "NSW", locations: ["Southern Highlands, NSW"] },
  { id: "blue-mountains", label: "Blue Mountains", state: "NSW", locations: ["Blue Mountains, NSW"] },
  {
    id: "central-west",
    label: "Central West",
    state: "NSW",
    // "Central West, NSW" does not resolve on realestate.com.au (falls back to
    // an Australia-wide search) — fan out across the region's main towns.
    locations: [
      "Orange, NSW, 2800",
      "Bathurst, NSW, 2795",
      "Dubbo, NSW, 2830",
      "Mudgee, NSW, 2850",
      "Parkes, NSW, 2870",
      "Cowra, NSW, 2794",
      "Lithgow, NSW, 2790",
      "Forbes, NSW, 2871",
      "Wellington, NSW, 2820",
    ],
  },
  {
    id: "new-england",
    label: "New England & North West",
    state: "NSW",
    // "New England, NSW" / "North West, NSW" do not resolve on
    // realestate.com.au — fan out across the region's main towns.
    locations: [
      "Tamworth, NSW, 2340",
      "Armidale, NSW, 2350",
      "Moree, NSW, 2400",
      "Gunnedah, NSW, 2380",
      "Inverell, NSW, 2360",
      "Narrabri, NSW, 2390",
      "Glen Innes, NSW, 2370",
      "Tenterfield, NSW, 2372",
    ],
  },
  { id: "riverina", label: "Riverina", state: "NSW", locations: ["Riverina, NSW"] },
  { id: "far-west", label: "Far West", state: "NSW", locations: ["Far West, NSW"] },
];

/**
 * Fifteen QLD catalogue groups containing seventeen provider-native search
 * units. The assignment covers all 77 Queensland local governments; the search
 * strings were live-tested on 3 August 2026. Council assignment describes
 * discovery coverage only—local planning controls remain council-specific.
 */
export const QLD_REGIONS: RegionDef[] = [
  { id: "qld-brisbane", label: "Brisbane", state: "QLD", locations: ["Brisbane - Greater Region, QLD"], lgas: ["Brisbane"] },
  { id: "qld-gold-coast", label: "Gold Coast", state: "QLD", locations: ["Gold Coast, QLD"], lgas: ["Gold Coast"] },
  { id: "qld-sunshine-coast", label: "Sunshine Coast & Noosa", state: "QLD", locations: ["Sunshine Coast, QLD"], lgas: ["Sunshine Coast", "Noosa"] },
  { id: "qld-moreton-bay", label: "Moreton Bay", state: "QLD", locations: ["Moreton Bay Region, QLD"], lgas: ["Moreton Bay"] },
  { id: "qld-ipswich", label: "Ipswich", state: "QLD", locations: ["Ipswich - Greater Region, QLD"], lgas: ["Ipswich"] },
  { id: "qld-logan", label: "Logan", state: "QLD", locations: ["Logan City - Region, QLD"], lgas: ["Logan"] },
  { id: "qld-redlands", label: "Redlands", state: "QLD", locations: ["Redland City Region, QLD"], lgas: ["Redland"] },
  { id: "qld-scenic-rim", label: "Scenic Rim", state: "QLD", locations: ["Scenic Rim Region, QLD"], lgas: ["Scenic Rim"] },
  { id: "qld-somerset", label: "Somerset", state: "QLD", locations: ["Somerset Region, QLD"], lgas: ["Somerset"] },
  { id: "qld-lockyer-valley", label: "Lockyer Valley", state: "QLD", locations: ["Lockyer Valley Region, QLD"], lgas: ["Lockyer Valley"] },
  { id: "qld-darling-downs", label: "Darling Downs & South West", state: "QLD", locations: ["Darling Downs, QLD"], lgas: ["Toowoomba", "Southern Downs", "Western Downs", "Goondiwindi", "Maranoa", "Balonne"] },
  {
    id: "qld-wide-bay-burnett",
    label: "Wide Bay Burnett",
    state: "QLD",
    locations: ["Bundaberg - Greater Region, QLD", "Hervey Bay - Greater Region, QLD", "Gympie - Greater Region, QLD"],
    lgas: ["Bundaberg", "Fraser Coast", "Gympie", "North Burnett", "South Burnett", "Cherbourg"],
  },
  { id: "qld-central", label: "Central QLD & Mackay–Whitsunday", state: "QLD", locations: ["Central Queensland - Region, QLD"], lgas: ["Banana", "Central Highlands", "Gladstone", "Livingstone", "Rockhampton", "Woorabinda", "Isaac", "Mackay", "Whitsunday"] },
  { id: "qld-northern", label: "North, Far North & Cape York", state: "QLD", locations: ["Northern Queensland - Region, QLD"], lgas: ["Aurukun", "Burdekin", "Cairns", "Cassowary Coast", "Charters Towers", "Cook", "Croydon", "Douglas", "Etheridge", "Hinchinbrook", "Hope Vale", "Kowanyama", "Lockhart River", "Mapoon", "Mareeba", "Napranum", "Northern Peninsula Area", "Palm Island", "Pormpuraaw", "Tablelands", "Torres", "Torres Strait Island", "Townsville", "Wujal Wujal", "Yarrabah"] },
  { id: "qld-western", label: "Western & North West QLD", state: "QLD", locations: ["Western Queensland - Region, QLD"], lgas: ["Barcaldine", "Barcoo", "Blackall-Tambo", "Boulia", "Bulloo", "Burke", "Carpentaria", "Cloncurry", "Diamantina", "Doomadgee", "Flinders", "Longreach", "McKinlay", "Mornington", "Mount Isa", "Murweh", "Paroo", "Quilpie", "Richmond", "Winton"] },
];

export const COVERED_STATES: CoveredState[] = ["NSW", "QLD"];
export const ALL_REGIONS: RegionDef[] = [...NSW_REGIONS, ...QLD_REGIONS];

export function getRegionById(id: string): RegionDef | undefined {
  return ALL_REGIONS.find((r) => r.id === id);
}

export function getRegionsByState(state: CoveredState): RegionDef[] {
  return ALL_REGIONS.filter((region) => region.state === state && region.enabled !== false);
}

/** All RealtyAPI location strings for a state-wide scan. Defaults to NSW for compatibility. */
export function stateWideLocations(state: CoveredState = "NSW"): string[] {
  return getRegionsByState(state).flatMap((region) => region.locations);
}
