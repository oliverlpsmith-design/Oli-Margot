/**
 * RealtyAPI.io client for realestate.com.au listing data.
 * Docs: https://www.realtyapi.io/api/realestateau
 *
 * Switched from Domain.com.au (Jul 2026): realestate.com.au carries far more
 * inventory, especially regional/rural NSW (state-wide buy total ~63k vs
 * Domain's much smaller pool). The public shapes (ListingSummary /
 * ListingDetail / SearchResponse) are preserved so routers and the client
 * keep working unchanged — REA rows are normalised into those shapes here.
 *
 * Verified behaviour against the live API (see REA_API_NOTES.md):
 * - `propertyType` filters (comma list of: house, land, acreage, rural, ...)
 * - `sortType=new-desc` returns newest-first
 * - land-size params are IGNORED upstream → filter client-side
 * - no ISO listing date; freshness comes from the details "Added X ago" badge
 */

const BASE = "https://realestateau.realtyapi.io";

/**
 * Viability-first default: dwellings on land + acreage + rural + vacant land,
 * excluding apartments/units/townhouses at the source.
 * REA tokens verified Jul 2026: house, land (residential land), acreage
 * (acreage/semi-rural), rural (farms/lifestyle/cropping).
 */
export const VIABLE_PROPERTY_TYPES = "house,land,acreage,rural";
/** All property types — used for niche backfill sweeps (no subdivision filter). */
export const ALL_PROPERTY_TYPES = "house,unit,apartment,townhouse,land,acreage,rural,villa,studio,retirement";

function apiKey(): string {
  const key = process.env.REALTY_API_KEY;
  if (!key) throw new Error("REALTY_API_KEY is not configured");
  return key;
}

async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const res = await fetch(`${BASE}${path}?${qs.toString()}`, {
    headers: { "x-realtyapi-key": apiKey() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RealtyAPI ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface ListingAddress {
  full?: string;
  streetNumber?: string;
  street?: string;
  suburb?: string;
  postcode?: string;
  state?: string;
}

export interface ListingSummary {
  id: number;
  listingType?: string;
  headline?: string;
  price?: string;
  address?: ListingAddress;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  carspaces?: number;
  landArea?: string;
  dateListed?: string;
  geoLocation?: { latitude: number; longitude: number };
  photos?: string[];
  /** Canonical listing URL on realestate.com.au. */
  listingUrl?: string;
}

export interface SearchResponse {
  message: string;
  source: string;
  total: number;
  nextPage: boolean;
  resultCount: number;
  searchResults: ListingSummary[];
}

export interface ListingDetail extends ListingSummary {
  description?: string;
  seoUrl?: string;
  marketInsights?: Record<string, unknown>;
  agency?: Record<string, unknown>;
  isAuction?: boolean;
  daysOnMarket?: number;
  photoCount?: number;
  /** Human freshness badge from REA, e.g. "Added 16 hours ago". */
  addedDisplay?: string;
  /** Estimated first-listed timestamp derived from the Added badge. */
  listedAtEstimate?: Date | null;
  /** REA construction status: "new" | "established" (reliable where present). */
  constructionStatus?: string;
  /** Dwelling floor area in m² from REA building_size (present on ~half of rows). */
  buildingSizeSqm?: number;
}

/* ------------------------------------------------------------------ */
/* Raw REA row shapes (subset we consume)                              */
/* ------------------------------------------------------------------ */

interface ReaAddress {
  street?: string;
  suburb?: string;
  postcode?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

interface ReaRow {
  listing_id?: string | number;
  channel?: string;
  url?: string;
  title?: string;
  description?: string;
  property_type?: string;
  construction_status?: string;
  price?: string;
  beds?: number;
  baths?: number;
  parking?: number;
  land_size?: { value?: number; unit?: string; display?: string } | null;
  building_size?: { value?: number; unit?: string; display?: string } | null;
  address?: ReaAddress;
  main_image?: string;
  images?: string[];
  agency?: Record<string, unknown>;
  details_components?: {
    summary?: { summary?: { secondaryBadges?: { description?: string }[] } };
  };
}

interface ReaSearchResponse {
  message: string;
  source: string;
  total: number;
  nextPage: boolean;
  resultCount: number;
  searchResults: ReaRow[];
}

function fullAddress(a?: ReaAddress): string | undefined {
  if (!a) return undefined;
  const parts = [a.street, a.suburb, a.state, a.postcode].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

/**
 * Parse REA's relative "Added X ago" badge into an estimated Date.
 * Examples: "Added 16 hours ago", "Added 3 days ago", "Added yesterday",
 * "Added 2 weeks ago", "Added 30+ days ago".
 */
export function parseAddedBadge(text: string | undefined | null, now = new Date()): Date | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (!t.includes("added")) return null;
  const ms = now.getTime();
  if (t.includes("today") || t.includes("just now")) return new Date(ms);
  if (t.includes("yesterday")) return new Date(ms - 24 * 3600_000);
  const m = t.match(/(\d+)\+?\s*(minute|hour|day|week|month)/);
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 10);
  const unitMs: Record<string, number> = {
    minute: 60_000,
    hour: 3600_000,
    day: 24 * 3600_000,
    week: 7 * 24 * 3600_000,
    month: 30 * 24 * 3600_000,
  };
  const per = unitMs[m[2]!] ?? 0;
  if (!per || !Number.isFinite(n)) return null;
  return new Date(ms - n * per);
}

/**
 * Parse a lot frontage/width in metres from free-text listing copy.
 * No structured field exists on REA — this catches common phrasings like
 * "14m frontage", "frontage of 18.5 metres", "Land Width: 14 m".
 * Returns null when no plausible width is mentioned (most listings).
 */
export function parseFrontageM(text: string | undefined | null): number | null {
  if (!text) return null;
  const t = text.replace(/<[^>]+>/g, " ").toLowerCase();
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:m|metre|meter)s?\s*(?:wide\s*)?(?:street\s*)?frontage/,
    /frontage\s*(?:of|:)?\s*(?:approx(?:imately)?\.?\s*)?(\d+(?:\.\d+)?)\s*(?:m\b|metre|meter)/,
    /land\s*width\s*:?\s*(\d+(?:\.\d+)?)\s*(?:m\b|metre|meter)/,
    /(\d+(?:\.\d+)?)\s*(?:m|metre|meter)s?\s*(?:wide|width)\b/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const v = Number.parseFloat(m[1]!);
      // Sanity range: residential frontages 3–200 m
      if (Number.isFinite(v) && v >= 3 && v <= 200) return v;
    }
  }
  return null;
}

/**
 * Parse a numeric asking price (AUD) from a listing's price display string.
 * Handles "$1,200,000", "Offers over $850,000", "$1.2m", "$950k", and
 * ranges ("$800,000 - $880,000" → low end). Returns null for auctions,
 * POA, or anything without a confident dollar figure.
 */
export function parsePriceNumeric(display: string | null | undefined): number | null {
  if (!display) return null;
  const text = display.toLowerCase();
  if (/auction|contact|poa|negotiation|tender|eoi|expressions/.test(text) && !/\$\s*[\d.]/.test(text)) {
    return null;
  }
  // $1.2m / $950k shorthand
  const short = text.match(/\$\s*(\d+(?:\.\d+)?)\s*(m|k)\b/);
  if (short) {
    const base = Number.parseFloat(short[1]!);
    const value = short[2] === "m" ? base * 1_000_000 : base * 1_000;
    return value >= 10_000 ? Math.round(value) : null;
  }
  // Standard $1,234,567 figures — take the FIRST match (low end of a range)
  const std = text.match(/\$\s*([\d,]{4,})/);
  if (std) {
    const value = Number.parseInt(std[1]!.replace(/,/g, ""), 10);
    return Number.isFinite(value) && value >= 10_000 ? value : null;
  }
  return null;
}

/**
 * Detect new-estate / house-and-land marketing language in listing copy.
 * Used with construction_status to exclude new builds that are almost never
 * practically subdividable.
 */
export function hasNewEstateKeywords(...texts: (string | undefined | null)[]): boolean {
  const t = texts.filter(Boolean).join(" ").replace(/<[^>]+>/g, " ").toLowerCase();
  if (!t) return false;
  const keywords = [
    "house and land",
    "house & land",
    "home and land",
    "home & land",
    "land package",
    "brand new home",
    "brand-new home",
    "brand new build",
    "newly built",
    "newly constructed",
    "new construction",
    "under construction",
    "to be built",
    "off the plan",
    "off-the-plan",
    "display home",
    "masterplanned",
    "master-planned",
    "master planned",
    "new estate",
    "new release estate",
    "land release",
    "fixed price build",
    "turnkey package",
    "turn-key package",
  ];
  if (keywords.some((k) => t.includes(k))) return true;
  // "X estate" community naming, e.g. "in the sought-after Willowdale Estate"
  return /\b(?:in|at|within)\s+(?:the\s+)?[a-z][a-z' -]{2,30}\s+estate\b/.test(t);
}

function normaliseRow(row: ReaRow): ListingSummary {
  const lat = row.address?.latitude;
  const lng = row.address?.longitude;
  return {
    id: Number(row.listing_id),
    listingType: row.channel,
    headline: row.title,
    price: row.price,
    address: {
      full: fullAddress(row.address),
      street: row.address?.street,
      suburb: row.address?.suburb,
      postcode: row.address?.postcode,
      state: row.address?.state,
    },
    propertyType: row.property_type,
    bedrooms: row.beds ?? undefined,
    bathrooms: row.baths ?? undefined,
    carspaces: row.parking ?? undefined,
    landArea: row.land_size?.display ?? (row.land_size?.value != null ? `${row.land_size.value} ${row.land_size.unit ?? "m2"}` : undefined),
    geoLocation: lat != null && lng != null ? { latitude: lat, longitude: lng } : undefined,
    photos: row.main_image ? [row.main_image, ...(row.images ?? []).slice(0, 5)] : (row.images ?? []).slice(0, 6),
    listingUrl: row.url,
  };
}

/**
 * Map legacy Domain propertyTypes tokens (still stored in old client filter
 * state / saved searches) onto REA tokens so old inputs keep working.
 */
export function toReaPropertyTypes(types: string | undefined): string | undefined {
  if (!types) return undefined;
  const mapping: Record<string, string> = {
    house: "house",
    acreagesemirural: "acreage",
    acreage: "acreage",
    rural: "rural",
    land: "land",
    vacantland: "land",
    developmentsite: "land",
  };
  const out = new Set<string>();
  for (const raw of types.split(",")) {
    const key = raw.trim().toLowerCase().replace(/[^a-z]/g, "");
    const mapped = mapping[key];
    if (mapped) out.add(mapped);
  }
  return out.size ? Array.from(out).join(",") : undefined;
}

export async function searchListings(opts: {
  location: string;
  page?: number;
  priceMin?: number;
  priceMax?: number;
  propertyTypes?: string;
  landSizeMin?: number;
  channel?: "buy" | "sold";
  sortType?: "new-desc";
}): Promise<SearchResponse> {
  const res = await get<ReaSearchResponse>("/search/bylocation", {
    location: opts.location,
    channel: opts.channel ?? "buy",
    page: opts.page,
    minPrice: opts.priceMin,
    maxPrice: opts.priceMax,
    propertyType: toReaPropertyTypes(opts.propertyTypes),
    sortType: opts.sortType,
  });
  let searchResults = (res.searchResults ?? []).map(normaliseRow);
  // REA ignores land-size params upstream — enforce the floor client-side
  // only when the advertised land size is present (unknown sizes pass through
  // for later verification, matching previous Domain behaviour).
  if (opts.landSizeMin) {
    const floor = opts.landSizeMin;
    searchResults = searchResults.filter((l) => {
      const sqm = parseLandAreaSqm(l.landArea);
      return sqm === null || sqm >= floor;
    });
  }
  return {
    message: res.message,
    source: res.source,
    total: res.total ?? 0,
    nextPage: Boolean(res.nextPage),
    resultCount: searchResults.length,
    searchResults,
  };
}

export async function getListingDetail(id: string | number): Promise<ListingDetail> {
  const res = await get<{ message?: string; detail: ReaRow }>("/details/byid", { listingId: id });
  // REA returns HTTP 200 with a "404: ..." message and empty detail for
  // off-market/removed listings.
  if (!res.detail || res.detail.listing_id === undefined) {
    throw new Error(res.message ?? `Listing ${id} not found or off-market`);
  }
  const base = normaliseRow(res.detail);
  const badge = res.detail.details_components?.summary?.summary?.secondaryBadges?.find((b) =>
    (b.description ?? "").toLowerCase().startsWith("added"),
  )?.description;
  const listedAtEstimate = parseAddedBadge(badge);
  const bs = res.detail.building_size;
  const buildingSizeSqm =
    bs?.value != null && Number.isFinite(bs.value) && (bs.unit ?? "m2").toLowerCase().replace(/[^a-z0-9]/g, "").startsWith("m2")
      ? bs.value
      : undefined;
  return {
    ...base,
    description: res.detail.description,
    agency: res.detail.agency,
    addedDisplay: badge,
    listedAtEstimate,
    constructionStatus: res.detail.construction_status ?? undefined,
    buildingSizeSqm,
    daysOnMarket: listedAtEstimate
      ? Math.max(0, Math.floor((Date.now() - listedAtEstimate.getTime()) / (24 * 3600_000)))
      : undefined,
  };
}

/**
 * True when a listing id is confirmed gone from the buy channel (sold,
 * withdrawn, or off-market). REA reports this via a "404: ..." message.
 */
export async function isListingOffMarket(id: string | number): Promise<boolean> {
  try {
    const res = await get<{ message?: string; detail?: ReaRow }>("/details/byid", { listingId: id });
    if (!res.detail || res.detail.listing_id === undefined) return true;
    return (res.message ?? "").includes("404");
  } catch {
    // Network/API failure — NOT evidence the listing is gone.
    return false;
  }
}

export async function autocompleteLocation(keyword: string): Promise<unknown> {
  return get("/autocomplete", { input: keyword });
}

/**
 * Search multiple location strings in parallel (region / state scope).
 * De-duplicates listings by id and by normalised address, interleaving
 * round-robin across locations for scope fairness.
 */
export async function searchListingsMulti(opts: {
  locations: string[];
  page?: number;
  priceMin?: number;
  priceMax?: number;
  propertyTypes?: string;
  landSizeMin?: number;
  sortType?: "new-desc";
}): Promise<{
  total: number;
  nextPage: boolean;
  resultCount: number;
  searchResults: ListingSummary[];
  perLocation: { location: string; total: number; error: boolean }[];
}> {
  const settled = await Promise.allSettled(
    opts.locations.map((location) =>
      searchListings({
        location,
        page: opts.page,
        priceMin: opts.priceMin,
        priceMax: opts.priceMax,
        propertyTypes: opts.propertyTypes,
        landSizeMin: opts.landSizeMin,
        sortType: opts.sortType,
      }),
    ),
  );

  const seen = new Set<number>();
  const perLocation: { location: string; total: number; error: boolean }[] = [];
  const perLocationResults: ListingSummary[][] = [];
  let total = 0;
  let nextPage = false;

  settled.forEach((result, i) => {
    const location = opts.locations[i]!;
    if (result.status === "fulfilled") {
      const r = result.value;
      total += r.total ?? 0;
      nextPage = nextPage || Boolean(r.nextPage);
      perLocation.push({ location, total: r.total ?? 0, error: false });
      perLocationResults.push(r.searchResults ?? []);
    } else {
      perLocation.push({ location, total: 0, error: true });
      perLocationResults.push([]);
    }
  });

  const seenAddress = new Set<string>();
  const merged: ListingSummary[] = [];
  const maxLen = Math.max(0, ...perLocationResults.map((r) => r.length));
  for (let i = 0; i < maxLen; i++) {
    for (const results of perLocationResults) {
      const listing = results[i];
      if (!listing || seen.has(listing.id)) continue;
      const addrKey = (listing.address?.full ?? "").toLowerCase().replace(/\s+/g, " ").trim();
      if (addrKey && seenAddress.has(addrKey)) continue;
      seen.add(listing.id);
      if (addrKey) seenAddress.add(addrKey);
      merged.push(listing);
    }
  }

  return { total, nextPage, resultCount: merged.length, searchResults: merged, perLocation };
}

export type PropertyCategory = "cash_flow" | "land_only" | "unknown";

/**
 * Classify a listing as a cash-flow subdivision candidate (existing dwelling
 * that can be rented while the DA runs) vs a land-only play.
 * Handles both legacy Domain tokens and REA property_type strings
 * ("residential land", "acreage/semi-rural", "mixed farming", ...).
 */
export function categoriseListing(listing: {
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
}): PropertyCategory {
  const type = (listing.propertyType ?? "").toLowerCase();
  const compact = type.replace(/[^a-z]/g, "");
  const landOnlyTypes = ["vacantland", "land", "residentialland", "developmentsite", "rurallifestyleland"];
  if (landOnlyTypes.includes(compact)) return "land_only";
  const hasDwellingSignal = (listing.bedrooms ?? 0) > 0 || (listing.bathrooms ?? 0) > 0;
  if (hasDwellingSignal) return "cash_flow";
  const dwellingTypes = ["house", "acreagesemirural", "acreage", "rural", "farm", "duplex", "townhouse", "villa", "semidetached", "lifestyle", "mixedfarming", "cropping", "horticulture", "livestock"];
  if (dwellingTypes.some((t) => compact.includes(t))) {
    // Typed as a dwelling/rural holding but no bed/bath data — for rural
    // categories with no dwelling signal, treat as land-only.
    if (["mixedfarming", "cropping", "horticulture", "livestock"].some((t) => compact.includes(t))) {
      return "land_only";
    }
    return "cash_flow";
  }
  if (type) return "land_only";
  return "unknown";
}

/**
 * Parse a landArea display string like "950m²", "2.5ha", "1,012 m2" into square metres.
 * Returns null when the value cannot be parsed.
 */
export function parseLandAreaSqm(landArea: string | undefined | null): number | null {
  if (!landArea) return null;
  const cleaned = landArea.replace(/,/g, "").trim().toLowerCase();
  const match = cleaned.match(/([\d.]+)\s*(ha|hectare|hectares|m²|m2|sqm|square metres|acres?|ac)?/);
  if (!match || !match[1]) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2] ?? "m2";
  if (unit.startsWith("ha") || unit.startsWith("hectare")) return value * 10000;
  if (unit.startsWith("ac")) return value * 4046.86;
  return value;
}
