/**
 * NSW Online DA API client — subdivision comparables.
 *
 * Open government API (no key): all DAs lodged on the NSW Planning Portal
 * since Jan 2019. Filters are passed via HTTP *headers*.
 * Docs: https://www.planningportal.nsw.gov.au/opendata/dataset/online-da-data-api
 */

const DA_URL = "https://api.apps1.nsw.gov.au/eplanning/data/v0/OnlineDA";

interface RawDaApplication {
  PlanningPortalApplicationNumber?: string;
  ApplicationStatus?: string;
  ApplicationType?: string;
  SubdivisionProposedFlag?: string;
  NumberOfExistingLots?: number;
  NumberOfProposedLots?: number;
  NumberOfNewDwellings?: number;
  CostOfDevelopment?: number;
  LodgementDate?: string;
  DeterminationDate?: string;
  DeterminationAuthority?: string;
  Council?: { CouncilName?: string };
  DevelopmentType?: { DevelopmentType?: string }[];
  SubdivisionType?: { SubdivisionType?: string }[];
  Location?: {
    FullAddress?: string;
    X?: string;
    Y?: string;
    Suburb?: string;
    Postcode?: string;
  }[];
}

export interface SubdivisionComparable {
  panNumber: string;
  address: string;
  suburb: string | null;
  status: string;
  determinationDate: string | null;
  lodgementDate: string | null;
  existingLots: number | null;
  proposedLots: number | null;
  subdivisionType: string | null;
  developmentTypes: string[];
  costOfDevelopment: number | null;
  distanceKm: number | null;
  latitude: number | null;
  longitude: number | null;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function isSubdivisionDa(app: RawDaApplication): boolean {
  if (app.SubdivisionProposedFlag === "Y") return true;
  return (app.DevelopmentType ?? []).some((d) => /subdivision/i.test(d.DevelopmentType ?? ""));
}

function toComparable(
  app: RawDaApplication,
  subject: { latitude: number; longitude: number } | null,
): SubdivisionComparable {
  const loc = app.Location?.[0];
  const lat = loc?.Y ? Number.parseFloat(loc.Y) : null;
  const lon = loc?.X ? Number.parseFloat(loc.X) : null;
  return {
    panNumber: app.PlanningPortalApplicationNumber ?? "Unknown",
    address: loc?.FullAddress ?? "Address unavailable",
    suburb: loc?.Suburb ?? null,
    status: app.ApplicationStatus ?? "Unknown",
    determinationDate: app.DeterminationDate ?? null,
    lodgementDate: app.LodgementDate ?? null,
    existingLots: app.NumberOfExistingLots ?? null,
    proposedLots: app.NumberOfProposedLots ?? null,
    subdivisionType: app.SubdivisionType?.[0]?.SubdivisionType ?? null,
    developmentTypes: (app.DevelopmentType ?? [])
      .map((d) => d.DevelopmentType ?? "")
      .filter(Boolean),
    costOfDevelopment: app.CostOfDevelopment ?? null,
    distanceKm:
      subject && lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)
        ? haversineKm(subject.latitude, subject.longitude, lat, lon)
        : null,
    latitude: Number.isFinite(lat as number) ? lat : null,
    longitude: Number.isFinite(lon as number) ? lon : null,
  };
}

async function fetchDaPage(
  councilName: string,
  lodgedFrom: string,
  page: number,
  pageSize = 500,
): Promise<{ apps: RawDaApplication[]; totalPages: number }> {
  const res = await fetch(DA_URL, {
    headers: {
      PageSize: String(pageSize),
      PageNumber: String(page),
      filters: JSON.stringify({
        filters: { CouncilName: [councilName], LodgementDateFrom: lodgedFrom },
      }),
    },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`OnlineDA API failed (${res.status})`);
  const data = (await res.json()) as {
    TotalPages?: number;
    Application?: RawDaApplication[];
  };
  return { apps: data.Application ?? [], totalPages: data.TotalPages ?? 1 };
}

/**
 * Find recent subdivision DAs in a council area, sorted by distance from the
 * subject property. Scans up to `maxPages` pages (500 DAs each) of the
 * council's DA feed from the past ~3 years.
 */
export async function findSubdivisionComparables(opts: {
  councilName: string;
  latitude?: number | null;
  longitude?: number | null;
  limit?: number;
  maxPages?: number;
}): Promise<{ comparables: SubdivisionComparable[]; scanned: number; councilName: string }> {
  const lodgedFrom = new Date(Date.now() - 3 * 365 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const maxPages = opts.maxPages ?? 4;
  const limit = opts.limit ?? 10;
  const subject =
    opts.latitude != null && opts.longitude != null
      ? { latitude: opts.latitude, longitude: opts.longitude }
      : null;

  const first = await fetchDaPage(opts.councilName, lodgedFrom, 1);
  let apps = first.apps;
  const pagesToFetch = Math.min(first.totalPages, maxPages);
  if (pagesToFetch > 1) {
    const rest = await Promise.allSettled(
      Array.from({ length: pagesToFetch - 1 }, (_, i) =>
        fetchDaPage(opts.councilName, lodgedFrom, i + 2),
      ),
    );
    for (const r of rest) {
      if (r.status === "fulfilled") apps = apps.concat(r.value.apps);
    }
  }

  const comparables = apps
    .filter(isSubdivisionDa)
    .map((app) => toComparable(app, subject))
    .sort((a, b) => {
      // Determined DAs first, then by distance (unknown distance last)
      const aDet = a.status === "Determined" ? 0 : 1;
      const bDet = b.status === "Determined" ? 0 : 1;
      if (aDet !== bDet) return aDet - bDet;
      return (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9);
    })
    .slice(0, limit);

  return { comparables, scanned: apps.length, councilName: opts.councilName };
}

/**
 * Map an MLS/zoning lgaName (e.g. "DUBBO REGIONAL") to the OnlineDA CouncilName.
 * The DA API matches case-insensitively but needs the "Council" suffix family.
 */
export function lgaToCouncilName(lgaName: string): string {
  const cleaned = lgaName.trim().replace(/\s+/g, " ");
  if (/council|shire|city of/i.test(cleaned)) return cleaned;
  return `${cleaned} Council`;
}

