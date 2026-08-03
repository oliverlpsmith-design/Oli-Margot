import AppShell from "@/components/AppShell";
import CatalogueMap, { type MapListing } from "@/components/CatalogueMap";
import { DiscoveryMethodology } from "@/components/DiscoveryMethodology";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { formatSqm, VERDICT_META, type Verdict } from "@/lib/analysis";
import { SUBDIVISION_CATEGORY } from "@/lib/subdivisionCategory";
import {
  formatLandFilterConversion,
  parseLandSizeFilter,
  parsePriceFilter,
} from "@/lib/catalogueFilterParsing";
import { applyCatalogueStateDefaults } from "@/lib/catalogueStateDefaults";
import { zoneChipClasses, ZONE_PRESETS } from "@/lib/zones";
import { trpc } from "@/lib/trpc";
import { SUBDIVISION_DEFAULT_MIN_LAND_INPUT } from "@shared/subdivisionDefaults";
import {
  Bath,
  BedDouble,
  Bell,
  BellRing,
  CalendarOff,
  Check,
  ChevronsUpDown,
  Clock,
  Coins,
  Database,
  Download,
  ExternalLink,
  Filter,
  Home,
  Info,
  Loader2,
  List,
  Map as MapIcon,
  MapPin,
  Mountain,
  RefreshCw,
  Ruler,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Lock, UserPlus } from "lucide-react";
import { ArrowLeft, Flame, Droplets, Landmark, Leaf, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const CATEGORY_META: Record<string, { label: string; className: string; icon: typeof Home }> = {
  cash_flow: { label: "Cash flow", className: "bg-sky-50 text-sky-700 border-sky-200", icon: Home },
  land_only: { label: "Land only", className: "bg-stone-100 text-stone-700 border-stone-300", icon: Mountain },
};

type VerdictFilter = "confirmed" | "subdividable" | "marginal" | "all";
type SortKey = "score_newest" | "score" | "newest" | "price_per_lot";
type ViewMode = "list" | "map";
type StateFilter = "all" | "NSW" | "QLD";

/** The full set of user-editable filter criteria (draft until applied). */
interface FilterState {
  state: StateFilter;
  regionId: string;
  verdictFilter: VerdictFilter;
  category: string;
  minScore: string;
  maxDom: string;
  minPrice: string;
  maxPrice: string;
  minLand: string;
  minFrontage: string;
  maxCoverage: string;
  excludeNewBuilds: boolean;
  /** Selected zoning codes (empty = any zoning). */
  zones: string[];
  search: string;
  newThisWeek: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  state: "all",
  regionId: "all",
  verdictFilter: "confirmed",
  category: "all",
  minScore: "0",
  maxDom: "any",
  minPrice: "",
  maxPrice: "",
  minLand: SUBDIVISION_DEFAULT_MIN_LAND_INPUT,
  minFrontage: "0",
  maxCoverage: "0",
  excludeNewBuilds: false,
  zones: [],
  search: "",
  newThisWeek: false,
};

function filtersEqual(a: FilterState, b: FilterState): boolean {
  return (
    a.state === b.state &&
    a.regionId === b.regionId &&
    a.verdictFilter === b.verdictFilter &&
    a.category === b.category &&
    a.minScore === b.minScore &&
    a.maxDom === b.maxDom &&
    a.minPrice.trim() === b.minPrice.trim() &&
    a.maxPrice.trim() === b.maxPrice.trim() &&
    a.minLand === b.minLand &&
    a.minFrontage === b.minFrontage &&
    a.maxCoverage === b.maxCoverage &&
    a.excludeNewBuilds === b.excludeNewBuilds &&
    a.zones.length === b.zones.length &&
    a.zones.every((z, i) => b.zones[i] === z) &&
    a.search.trim() === b.search.trim() &&
    a.newThisWeek === b.newThisWeek
  );
}

const VERDICT_FILTER_MAP: Record<VerdictFilter, Verdict[] | undefined> = {
  confirmed: ["subdividable", "marginal"],
  subdividable: ["subdividable"],
  marginal: ["marginal"],
  all: ["subdividable", "marginal", "not_subdividable", "unknown"],
};

export function daysOnMarket(listedAt: Date | null | undefined, firstSeenAt: Date | null | undefined): number | null {
  const base = listedAt ?? firstSeenAt;
  if (!base) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(base).getTime()) / 86_400_000));
}

export function domLabel(days: number | null): string {
  if (days === null) return "Listing age unknown";
  if (days === 0) return "Listed today";
  if (days === 1) return "Listed yesterday";
  return `Listed ${days} days ago`;
}

/** $/potential-lot, or null when either input is missing. */
export function pricePerLot(priceNumeric: string | null | undefined, potentialLots: number | null | undefined): number | null {
  const price = priceNumeric != null ? Number(priceNumeric) : null;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  if (potentialLots == null || potentialLots < 1) return null;
  return Math.round(price / potentialLots);
}

function formatAud(value: number): string {
  return value.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

/** Build a CSV string from export rows (RFC-4180 quoting). */
export function buildCatalogueCsv(rows: CsvRow[]): string {
  const headers = [
    "address", "suburb", "postcode", "state", "region", "price", "price_numeric",
    "land_area_sqm", "min_lot_size_sqm", "zone", "lga", "potential_lots",
    "price_per_lot", "verdict", "score", "category", "days_on_market",
    "listed_or_first_seen", "listing_url",
  ];
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => {
    const dom = daysOnMarket(r.listedAt, r.firstSeenAt);
    const ppl = pricePerLot(r.priceNumeric, r.potentialLots);
    const listed = r.listedAt ?? r.firstSeenAt;
    return [
      r.address, r.suburb, r.postcode, r.state, r.regionId, r.priceDisplay, r.priceNumeric,
      r.landAreaSqm, r.minLotSizeSqm, r.zoneCode, r.lgaName, r.potentialLots,
      ppl, r.verdict, r.score, r.category, dom,
      listed ? new Date(listed).toISOString().slice(0, 10) : "",
      r.listingUrl,
    ].map(esc).join(",");
  });
  return [headers.join(","), ...lines].join("\n");
}

interface CsvRow {
  address: string | null;
  suburb: string | null;
  postcode: string | null;
  state: string | null;
  regionId: string | null;
  priceDisplay: string | null;
  priceNumeric: string | null;
  landAreaSqm: string | null;
  minLotSizeSqm: string | null;
  zoneCode: string | null;
  lgaName: string | null;
  potentialLots: number | null;
  verdict: string | null;
  score: number | null;
  category: string | null;
  listedAt: Date | null;
  firstSeenAt: Date | null;
  listingUrl: string | null;
}

export default function Catalogue() {
  const { user, loading: authLoading } = useAuth();
  /** Number of free teaser cards shown to unauthenticated visitors. */
  const TEASER_COUNT = 5;
  /** Whether the sign-up gate should be shown (unauthenticated, auth check resolved). */
  const showGate = !authLoading && !user;
  // Draft filters: edited freely in the UI. Applied filters: drive the query,
  // updated only when the user clicks "Apply filters".
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("score_newest");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [zonePickerOpen, setZonePickerOpen] = useState(false);

  const setDraftField = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setDraftState = (state: StateFilter) =>
    setDraft((d) => applyCatalogueStateDefaults(d, state));

  const toggleDraftZone = (zone: string) =>
    setDraft((d) => ({
      ...d,
      zones: d.zones.includes(zone)
        ? d.zones.filter((z) => z !== zone)
        : [...d.zones, zone].sort(),
    }));

  /**
   * Toggle a whole zone-group preset. Only codes actually present in the
   * catalogue count; if every available code of the group is already
   * selected the group is removed, otherwise the missing ones are added.
   */
  const toggleDraftZoneGroup = (presetCodes: string[], availableCodes: string[]) => {
    const available = presetCodes.filter((c) => availableCodes.includes(c));
    if (available.length === 0) return;
    setDraft((d) => {
      const allSelected = available.every((c) => d.zones.includes(c));
      const zones = allSelected
        ? d.zones.filter((z) => !available.includes(z))
        : Array.from(new Set([...d.zones, ...available])).sort();
      return { ...d, zones };
    });
  };

  const isDirty = !filtersEqual(draft, applied);

  const draftMinPrice = parsePriceFilter(draft.minPrice);
  const draftMaxPrice = parsePriceFilter(draft.maxPrice);
  const draftMinLand = parseLandSizeFilter(draft.minLand);
  const priceRangeError =
    draftMinPrice.value !== undefined &&
    draftMaxPrice.value !== undefined &&
    draftMinPrice.value > draftMaxPrice.value
      ? "Minimum price cannot be higher than maximum price."
      : null;
  const hasInvalidNumericFilter = Boolean(
    draftMinPrice.error || draftMaxPrice.error || draftMinLand.error || priceRangeError,
  );

  const applyFilters = () => {
    const firstError = draftMinPrice.error ?? draftMaxPrice.error ?? draftMinLand.error ?? priceRangeError;
    if (firstError) {
      toast.error(firstError);
      return;
    }
    setApplied({ ...draft, search: draft.search.trim() });
    setPage(1);
  };

  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setPage(1);
  };

  const filters = useMemo(
    () => ({
      state: applied.state === "all" ? undefined : applied.state,
      regionId: applied.regionId === "all" ? undefined : applied.regionId,
      verdicts: VERDICT_FILTER_MAP[applied.verdictFilter],
      category: applied.category === "all" ? undefined : (applied.category as "cash_flow" | "land_only"),
      minScore: applied.minScore === "0" ? undefined : Number(applied.minScore),
      maxDaysOnMarket: applied.maxDom === "any" ? undefined : Number(applied.maxDom),
      minPrice: parsePriceFilter(applied.minPrice).value,
      maxPrice: parsePriceFilter(applied.maxPrice).value,
      minLandAreaSqm: parseLandSizeFilter(applied.minLand).value,
      minFrontageM: applied.minFrontage === "0" ? undefined : Number(applied.minFrontage),
      maxCoveragePct: applied.maxCoverage === "0" ? undefined : Number(applied.maxCoverage),
      excludeNewBuilds: applied.excludeNewBuilds || undefined,
      zones: applied.zones.length > 0 ? applied.zones : undefined,
      search: applied.search || undefined,
      newThisWeek: applied.newThisWeek || undefined,
      sort,
      page,
      // Unauthenticated visitors get a teaser page of TEASER_COUNT+1 cards
      // (the +1 lets us detect "there are more" and show the gate).
      // Auth state is resolved before this memo runs because showGate depends on authLoading.
      pageSize: showGate ? TEASER_COUNT + 1 : 24,
    }),
    [applied, sort, page, showGate],
  );

  const browse = trpc.catalogue.browse.useQuery(filters, {
    placeholderData: (prev) => prev,
    enabled: viewMode === "list",
  });
  const mapFilters = useMemo(() => {
    const { sort: _s, page: _p, pageSize: _ps, ...rest } = filters;
    return rest;
  }, [filters]);
  const mapQuery = trpc.catalogue.map.useQuery(mapFilters, {
    placeholderData: (prev) => prev,
    enabled: viewMode === "map",
  });
  const zoneMix = trpc.catalogue.zoneMix.useQuery(mapFilters, {
    placeholderData: (prev) => prev,
  });
  const stats = trpc.catalogue.stats.useQuery();
  const regions = trpc.property.regions.useQuery();
  const zoneCodeInput = useMemo(
    () => ({ state: draft.state === "all" ? undefined : draft.state }),
    [draft.state],
  );
  const zoneCodes = trpc.catalogue.zoneCodes.useQuery(zoneCodeInput, { staleTime: 5 * 60_000 });
  const scanStatus = trpc.catalogue.scanStatus.useQuery(undefined, {
    refetchInterval: (q) => (q.state.data?.status === "running" ? 15_000 : false),
  });
  const utils = trpc.useUtils();
  const savedSearches = trpc.savedSearch.list.useQuery(undefined, { enabled: Boolean(user) });
  const createSaved = trpc.savedSearch.create.useMutation({
    onSuccess: () => {
      toast.success("Search saved — you'll be alerted when new listings match");
      setSaveDialogOpen(false);
      setSaveName("");
      utils.savedSearch.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteSaved = trpc.savedSearch.delete.useMutation({
    onSuccess: () => utils.savedSearch.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const runScan = trpc.catalogue.runScan.useMutation({
    onSuccess: (p) => {
      toast.success(
        p.done
          ? `Scan complete — ${p.added} added, ${p.markedSold} marked sold`
          : `Scan slice finished (${p.unitsDone}/${p.unitsTotal} areas) — run again to continue`,
      );
      utils.catalogue.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const total = browse.data?.total ?? 0;
  const pageSize = browse.data?.pageSize ?? 24;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const resetPage = () => setPage(1);

  const savedSearchFilters = useMemo(
    () => ({
      state: filters.state,
      regionId: filters.regionId,
      verdicts: filters.verdicts,
      category: filters.category,
      minScore: filters.minScore,
      maxDaysOnMarket: filters.maxDaysOnMarket,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      // Persist an explicit zero when the user clears the default. The server
      // treats a missing value as the 100-acre subdivision default, while zero
      // remains a deliberate no-floor override.
      minLandAreaSqm: filters.minLandAreaSqm ?? 0,
      minFrontageM: filters.minFrontageM,
      maxCoveragePct: filters.maxCoveragePct,
      excludeNewBuilds: filters.excludeNewBuilds,
      zones: filters.zones,
      search: filters.search,
      newThisWeek: filters.newThisWeek,
    }),
    [filters],
  );

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const rows = await utils.catalogue.export.fetch({ ...savedSearchFilters, sort });
      if (!rows.length) {
        toast.info("Nothing to export — no listings match the current filters");
        return;
      }
      const csv = buildCatalogueCsv(rows as unknown as CsvRow[]);
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `investor-scout-catalogue-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length.toLocaleString()} listings`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell>
      <div className="border-b bg-card">
        <div className="container py-8">
          <Link href="/">
            <button className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </button>
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="mb-3 inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {SUBDIVISION_CATEGORY.badgeLabel}
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {SUBDIVISION_CATEGORY.title}
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {SUBDIVISION_CATEGORY.description}
              </p>
            </div>
            {stats.data && (
              <div className="flex gap-4 text-sm">
                <div className="text-right">
                  <p className="font-semibold text-foreground">{stats.data.active.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">active listings</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-700">{stats.data.subdividable.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">subdividable</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-amber-700">{stats.data.marginal.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">marginal</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="container py-8">
        <DiscoveryMethodology category="subdivision" className="mb-5" />

        {/* Quick address / suburb search bar */}
        <form
          className="flex gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              value={draft.search}
              onChange={(e) => setDraftField("search", e.target.value)}
              placeholder="Search by address, suburb, postcode or LGA…"
            />
          </div>
          <Button type="submit" variant={draft.search !== applied.search ? "default" : "secondary"} className="gap-1.5 shrink-0">
            <Search className="h-4 w-4" /> Search
          </Button>
          {applied.search && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setDraftField("search", ""); setApplied(prev => ({ ...prev, search: "" })); }}>
              Clear
            </Button>
          )}
        </form>

        {/* Zoning mix strip */}
        {zoneMix.data && zoneMix.data.zones.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs mb-4">
            <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] mr-1">
              Zoning mix
            </span>
            {zoneMix.data.zones.map((z) => {
              const pct = zoneMix.data!.total > 0 ? Math.round((z.count / zoneMix.data!.total) * 100) : 0;
              return (
                <Badge
                  key={z.zoneCode}
                  variant="outline"
                  className={`gap-1 font-normal ${zoneChipClasses(z.zoneCode)}`}
                >
                  <span className="font-semibold">{z.zoneCode}</span>
                  {z.count.toLocaleString()}
                  <span className="opacity-70">({pct}%)</span>
                </Badge>
              );
            })}
            {(() => {
              const shown = zoneMix.data!.zones.reduce((s, z) => s + z.count, 0);
              const rest = zoneMix.data!.total - shown;
              return rest > 0 ? (
                <span className="text-muted-foreground">
                  +{rest.toLocaleString()} other / unknown
                </span>
              ) : null;
            })()}
            <span className="text-muted-foreground/60 ml-1 text-[10px]">
              — top zones in current filtered view
            </span>
          </div>
        )}

        {/* Admin scan strip */}
        {user?.role === "admin" && (
          <Card className="mb-6 border-dashed">
            <CardContent className="py-3 flex flex-wrap items-center gap-3 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">
                {scanStatus.data
                  ? `Last scan: ${scanStatus.data.mode === "full_sweep" ? "full sweep" : "incremental"} · ${scanStatus.data.status} · ${scanStatus.data.listingsAdded} added · ${scanStatus.data.listingsMarkedSold} marked sold`
                  : "No scans recorded yet"}
              </span>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={runScan.isPending}
                  onClick={() => runScan.mutate({ mode: "incremental" })}
                >
                  {runScan.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Run incremental scan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="py-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Select value={draft.state} onValueChange={(v) => setDraftState(v as StateFilter)}>
              <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">NSW + QLD</SelectItem>
                <SelectItem value="NSW">New South Wales</SelectItem>
                <SelectItem value="QLD">Queensland</SelectItem>
              </SelectContent>
            </Select>
            {draft.state === "QLD" && (
              <p className="sm:col-span-2 md:col-span-3 xl:col-span-6 -mt-1 text-xs text-muted-foreground">
                Queensland shows all analysed research listings and clears the NSW 100-acre default. Planning status remains unverified unless a validated council source supports it.
              </p>
            )}
            <Select value={draft.regionId} onValueChange={(v) => setDraftField("regionId", v)}>
              <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.data?.filter((r) => draft.state === "all" || r.state === draft.state).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.label} ({r.state})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={draft.verdictFilter} onValueChange={(v) => setDraftField("verdictFilter", v as VerdictFilter)}>
              <SelectTrigger><SelectValue placeholder="Verdict" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">Subdividable + marginal</SelectItem>
                <SelectItem value="subdividable">Subdividable only</SelectItem>
                <SelectItem value="marginal">Marginal only</SelectItem>
                <SelectItem value="all">All analysed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={draft.category} onValueChange={(v) => setDraftField("category", v)}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="cash_flow">Cash flow (house on land)</SelectItem>
                <SelectItem value="land_only">Land only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={draft.minScore} onValueChange={(v) => setDraftField("minScore", v)}>
              <SelectTrigger><SelectValue placeholder="Min score" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any score</SelectItem>
                <SelectItem value="50">Score 50+</SelectItem>
                <SelectItem value="65">Score 65+</SelectItem>
                <SelectItem value="80">Score 80+</SelectItem>
              </SelectContent>
            </Select>
            <Select value={draft.maxDom} onValueChange={(v) => setDraftField("maxDom", v)}>
              <SelectTrigger><SelectValue placeholder="Days on market" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any age</SelectItem>
                <SelectItem value="3">Last 3 days</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label htmlFor="catalogue-min-price" className="text-xs text-muted-foreground">Minimum price</Label>
              <Input
                id="catalogue-min-price"
                value={draft.minPrice}
                onChange={(e) => setDraftField("minPrice", e.target.value)}
                inputMode="decimal"
                placeholder="e.g. $200,000"
                aria-invalid={Boolean(draftMinPrice.error || priceRangeError)}
              />
              {draftMinPrice.error && <p className="text-[11px] text-destructive">{draftMinPrice.error}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="catalogue-max-price" className="text-xs text-muted-foreground">Maximum price</Label>
              <Input
                id="catalogue-max-price"
                value={draft.maxPrice}
                onChange={(e) => setDraftField("maxPrice", e.target.value)}
                inputMode="decimal"
                placeholder="e.g. $1,000,000"
                aria-invalid={Boolean(draftMaxPrice.error || priceRangeError)}
              />
              {draftMaxPrice.error && <p className="text-[11px] text-destructive">{draftMaxPrice.error}</p>}
            </div>
            <Select value={sort} onValueChange={(v) => { setSort(v as SortKey); resetPage(); }}>
              <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="score_newest">Best (score + freshness)</SelectItem>
                <SelectItem value="score">Highest score</SelectItem>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="price_per_lot">Best value ($/lot)</SelectItem>
              </SelectContent>
            </Select>
            {/* False-positive reduction filters */}
            <div className="sm:col-span-2 md:col-span-3 xl:col-span-6 border-t pt-3 mt-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" /> Practicality filters — knock out false positives
              </p>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="catalogue-min-land" className="text-xs text-muted-foreground">Minimum land size</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/70" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64">
                        Starts at 100 acres to reduce small-block false positives. You can change or clear it; accepted units are acres, ac, sqm, m², or a bare sqm number.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="catalogue-min-land"
                    value={draft.minLand}
                    onChange={(e) => setDraftField("minLand", e.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 2 acres or 8,000 sqm"
                    aria-invalid={Boolean(draftMinLand.error)}
                  />
                  {draftMinLand.error ? (
                    <p className="text-[11px] text-destructive">{draftMinLand.error}</p>
                  ) : formatLandFilterConversion(draftMinLand.value) ? (
                    <p className="text-[11px] text-muted-foreground">{formatLandFilterConversion(draftMinLand.value)}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    Default: 100 acres. Change or clear this value to widen the catalogue.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Min lot width</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/70" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-60">
                        Frontage is parsed from listing descriptions where mentioned. Only
                        listings with a known narrower frontage are excluded — unknown widths
                        still show.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select value={draft.minFrontage} onValueChange={(v) => setDraftField("minFrontage", v)}>
                    <SelectTrigger><SelectValue placeholder="Min lot width" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Any width</SelectItem>
                      <SelectItem value="10">10 m+</SelectItem>
                      <SelectItem value="12">12 m+</SelectItem>
                      <SelectItem value="15">15 m+</SelectItem>
                      <SelectItem value="18">18 m+</SelectItem>
                      <SelectItem value="20">20 m+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Max dwelling coverage</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/70" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-60">
                        Share of the lot covered by the dwelling (floor area ÷ land area).
                        Reported on roughly half of listings — unknown coverage still shows.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select value={draft.maxCoverage} onValueChange={(v) => setDraftField("maxCoverage", v)}>
                    <SelectTrigger><SelectValue placeholder="Max coverage" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Any coverage</SelectItem>
                      <SelectItem value="15">Under 15%</SelectItem>
                      <SelectItem value="25">Under 25%</SelectItem>
                      <SelectItem value="35">Under 35%</SelectItem>
                      <SelectItem value="50">Under 50%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Build year</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/70" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-60">
                        realestate.com.au does not publish build year. Use the new-build
                        exclusion toggle instead — it uses REA's construction status.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select disabled value="na">
                    <SelectTrigger className="opacity-60">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarOff className="h-3.5 w-3.5" /> Data not available
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="na">Data not available</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Zoning</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/70" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-60">
                        Planning Portal zoning captured during analysis. Select one or
                        more codes — listings with unknown zoning are excluded when set.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Popover open={zonePickerOpen} onOpenChange={setZonePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={zonePickerOpen}
                        className="w-full justify-between font-normal h-9 px-3"
                      >
                        <span className="truncate">
                          {draft.zones.length === 0
                            ? "Any zoning"
                            : draft.zones.length <= 3
                              ? draft.zones.join(", ")
                              : `${draft.zones.slice(0, 2).join(", ")} +${draft.zones.length - 2}`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search zone codes…" />
                        <CommandList>
                          <CommandEmpty>No zone codes found</CommandEmpty>
                          <CommandGroup heading="Presets">
                            {draft.state !== "QLD" && ZONE_PRESETS.map((preset) => {
                              const availableCodes = (zoneCodes.data ?? []).map((z) => z.zoneCode);
                              const available = preset.codes.filter((c) => availableCodes.includes(c));
                              if (available.length === 0) return null;
                              const allSelected = available.every((c) => draft.zones.includes(c));
                              return (
                                <CommandItem
                                  key={preset.label}
                                  value={`preset ${preset.label}`}
                                  onSelect={() => toggleDraftZoneGroup(preset.codes, availableCodes)}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${allSelected ? "opacity-100" : "opacity-0"}`}
                                  />
                                  <span>{preset.label}</span>
                                  <span className="ml-auto text-xs text-muted-foreground">
                                    {available.length}
                                  </span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                          <CommandGroup>
                            {draft.zones.length > 0 && (
                              <CommandItem
                                value="__clear"
                                onSelect={() => setDraftField("zones", [])}
                                className="text-muted-foreground"
                              >
                                Clear selection ({draft.zones.length})
                              </CommandItem>
                            )}
                            {zoneCodes.data?.map((z) => (
                              <CommandItem
                                key={z.zoneCode}
                                value={z.zoneCode}
                                onSelect={() => toggleDraftZone(z.zoneCode)}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    draft.zones.includes(z.zoneCode) ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <span className="font-medium">{z.zoneCode}</span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {z.count.toLocaleString()}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1 flex sm:block">
                  <Label className="text-xs text-muted-foreground">New builds &amp; estates</Label>
                  <div className="flex items-center gap-2 h-9">
                    <Switch
                      id="exclude-new-builds"
                      checked={draft.excludeNewBuilds}
                      onCheckedChange={(v) => setDraftField("excludeNewBuilds", v)}
                    />
                  <Label htmlFor="exclude-new-builds" className="text-sm font-normal cursor-pointer">
                    Exclude new builds &amp; estate listings
                  </Label>
                </div>
              </div>
              <div className="space-y-1 flex sm:block">
                <Label className="text-xs text-muted-foreground">Recency</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    id="new-this-week"
                    checked={draft.newThisWeek}
                    onCheckedChange={(v) => setDraftField("newThisWeek", v)}
                  />
                  <Label htmlFor="new-this-week" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> New this week only
                  </Label>
                </div>
              </div>
            </div>
          </div>
            <form
              className="sm:col-span-2 md:col-span-3 xl:col-span-6 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                applyFilters();
              }}
            >
              <Input
                value={draft.search}
                onChange={(e) => setDraftField("search", e.target.value)}
                placeholder="Filter by suburb, postcode, address or LGA…"
              />
              <Button
                type="submit"
                className="gap-1.5"
                variant={isDirty ? "default" : "secondary"}
                disabled={hasInvalidNumericFilter}
              >
                <Search className="h-4 w-4" /> Apply filters
              </Button>
              <Button type="button" variant="ghost" onClick={resetFilters}>
                Reset
              </Button>
            </form>
            {isDirty && (
              <p className="sm:col-span-2 md:col-span-3 xl:col-span-6 text-xs text-amber-700 -mt-1">
                Filter changes not applied yet — click "Apply filters" to update results.
              </p>
            )}
            {priceRangeError && (
              <p className="sm:col-span-2 md:col-span-3 xl:col-span-6 text-xs text-destructive -mt-1">
                {priceRangeError}
              </p>
            )}
            {/* Toolbar: export + save search */}
            <div className="sm:col-span-2 md:col-span-3 xl:col-span-6 flex flex-wrap items-center gap-2 border-t pt-3">
              <div className="inline-flex rounded-md border overflow-hidden mr-1" role="group" aria-label="View mode">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5 rounded-none"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" /> List
                </Button>
                <Button
                  variant={viewMode === "map" ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5 rounded-none border-l"
                  onClick={() => setViewMode("map")}
                >
                  <MapIcon className="h-4 w-4" /> Map
                </Button>
                {showGate && (
                  <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Lock className="h-3 w-3" /> Sign in to unlock map
                  </span>
                )}
              </div>
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={exporting}
                  onClick={handleExportCsv}
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export CSV
                </Button>
              )}
              {user ? (
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Bell className="h-4 w-4" /> Save this search
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Save this search for alerts</DialogTitle>
                      <DialogDescription>
                        The nightly scan checks every saved search against newly listed
                        properties. New matches appear here as an alert badge.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="save-name">Name</Label>
                      <Input
                        id="save-name"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder='e.g. "Riverina, score 80+, fresh"'
                        maxLength={120}
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        disabled={!saveName.trim() || createSaved.isPending}
                        onClick={() => createSaved.mutate({ name: saveName.trim(), filters: savedSearchFilters })}
                        className="gap-1.5"
                      >
                        {createSaved.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                        Save search
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => startLogin()}>
                  <Bell className="h-4 w-4" /> Sign in to save searches &amp; get alerts
                </Button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                Exports up to 2,000 rows of the current filtered view
              </span>
            </div>
            {/* Saved searches strip */}
            {user && (savedSearches.data?.length ?? 0) > 0 && (
              <div className="sm:col-span-2 md:col-span-3 xl:col-span-6 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Saved searches
                </span>
                {savedSearches.data!.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 pl-3 pr-1 py-1 text-xs"
                  >
                    {s.lastMatchCount > 0 ? (
                      <BellRing className="h-3 w-3 text-primary" />
                    ) : (
                      <Bell className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="font-medium">{s.name}</span>
                    {s.lastMatchCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground border-transparent h-4 px-1.5 text-[10px]">
                        {s.lastMatchCount} new
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteSaved.mutate({ id: s.id })}
                      aria-label={`Delete saved search ${s.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {viewMode === "map" ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {mapQuery.data
                ? `${mapQuery.data.length.toLocaleString()} geolocated listings on map${mapQuery.data.length >= 2500 ? " (capped at 2,500 — narrow the filters to see all)" : ""}`
                : "Loading map data…"}
            </p>
            <CatalogueMap
              listings={(mapQuery.data ?? []) as MapListing[]}
              loading={mapQuery.isLoading || mapQuery.isFetching}
            />
            {mapQuery.data && mapQuery.data.length === 0 && !mapQuery.isLoading && (
              <p className="text-sm text-muted-foreground mt-3 text-center">
                No geolocated listings match these filters — try widening them.
              </p>
            )}
          </>
        ) : browse.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : total === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-foreground mb-1">No catalogue entries match these filters</p>
              <p className="text-sm">
                {stats.data?.active === 0
                  ? "The catalogue is still being built — the NSW and QLD sweeps are in progress. Check back soon."
                  : "Try widening the filters — e.g. include marginal verdicts or any listing age."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {total.toLocaleString()} listings · page {page} of {totalPages}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {browse.data?.rows.map((row, rowIndex) => {
                const isTeaser = showGate && rowIndex >= TEASER_COUNT;
                const vm = VERDICT_META[(row.verdict ?? "unknown") as Verdict];
                const cm = row.category ? CATEGORY_META[row.category] : null;
                const dom = daysOnMarket(row.listedAt, row.firstSeenAt);
                const land = row.landAreaSqm ? Number(row.landAreaSqm) : null;
                const mls = row.minLotSizeSqm ? Number(row.minLotSizeSqm) : null;
                return (
                  <Card
                    key={row.listingId}
                    className={`overflow-hidden flex flex-col transition-all duration-200 cursor-pointer hover:shadow-md hover:border-primary/40${isTeaser ? " select-none pointer-events-none" : ""}`}
                    aria-hidden={isTeaser}
                    onClick={isTeaser ? undefined : () => { if (!isTeaser) window.location.href = `/property/${row.id}`; }}
                  >
                    <div className="relative">
                      {row.imageUrl ? (
                        <img
                          src={row.imageUrl}
                          alt={row.address ?? "Property"}
                          className={`h-40 w-full object-cover${isTeaser ? " blur-sm" : ""}`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-40 w-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                          No photo
                        </div>
                      )}
                      <Badge className={`absolute top-2 left-2 border ${vm.className}`}>
                        {vm.label}
                        {!isTeaser && row.verdict === "subdividable" && row.potentialLots
                          ? ` · ${row.potentialLots} lots`
                          : ""}
                      </Badge>
                      {!isTeaser && row.score !== null && row.score > 0 && (
                        <Badge variant="secondary" className="absolute top-2 right-2 bg-background/90">
                          Score {row.score}
                        </Badge>
                      )}
                      {!isTeaser && dom !== null && dom <= 7 && (
                        <Badge className="absolute bottom-2 left-2 bg-primary text-primary-foreground border-transparent gap-1">
                          <Clock className="h-3 w-3" /> {dom === 0 ? "New today" : `${dom}d on market`}
                        </Badge>
                      )}
                      {!isTeaser && row.firstSeenAt && (new Date().getTime() - new Date(row.firstSeenAt).getTime()) < 7 * 24 * 3600_000 && (
                        <Badge className="absolute bottom-2 right-2 bg-emerald-600 text-white border-transparent gap-1 text-[10px]">
                          <Sparkles className="h-2.5 w-2.5" /> New
                        </Badge>
                      )}
                    </div>
                    <CardContent className={`pt-4 flex-1 flex flex-col gap-2${isTeaser ? " blur-sm" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-foreground leading-snug">
                          {row.address ?? row.headline ?? `${row.suburb ?? "AU"} listing`}
                        </p>
                        {cm && <Badge className={`shrink-0 border ${cm.className}`}>{cm.label}</Badge>}
                      </div>
                      <p className="text-sm font-semibold text-primary">
                        {row.priceDisplay || "Price on request"}
                      </p>
                      {(() => {
                        const ppl = pricePerLot(row.priceNumeric, row.potentialLots);
                        return ppl !== null ? (
                          <p className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                            <Coins className="h-3 w-3" /> {formatAud(ppl)} per potential lot
                            {row.potentialLots ? ` (${row.potentialLots} lots)` : ""}
                          </p>
                        ) : null;
                      })()}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {row.bedrooms != null && (
                          <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {row.bedrooms}</span>
                        )}
                        {row.bathrooms != null && (
                          <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {row.bathrooms}</span>
                        )}
                        {land !== null && (
                          <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {formatSqm(land)}</span>
                        )}
                        {row.suburb && (
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {row.suburb}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                        <span>{mls !== null ? `Min lot ${formatSqm(mls)}` : "Min lot unknown"}</span>
                        {row.zoneCode && (
                          <Badge
                            variant="outline"
                            className={`px-1.5 py-0 text-[10px] font-semibold ${zoneChipClasses(row.zoneCode)}`}
                          >
                            {row.zoneCode}
                          </Badge>
                        )}
                        {row.lgaName && <span>· {row.lgaName}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                        {row.fsrValue && (
                          <Badge variant="secondary" className="text-[10px]">
                            FSR {row.fsrValue}:1
                          </Badge>
                        )}
                        {row.maxBuildingHeightM && (
                          <Badge variant="secondary" className="text-[10px]">
                            Max {row.maxBuildingHeightM}m
                          </Badge>
                        )}
                      </div>
                      {/* Risk flags row — only shown when at least one flag is set */}
                      {(row.bushfireCategory || row.floodRisk || row.heritageFlag || row.biodiversityFlag || row.acidSulfateClass) && (
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                          {row.bushfireCategory && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-orange-400 text-orange-600 dark:text-orange-400 gap-0.5">
                              <Flame className="h-2.5 w-2.5" />
                              {row.bushfireCategory.length > 22
                                ? row.bushfireCategory.substring(0, 20) + "\u2026"
                                : row.bushfireCategory}
                            </Badge>
                          )}
                          {row.floodRisk && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-blue-400 text-blue-600 dark:text-blue-400 gap-0.5">
                              <Droplets className="h-2.5 w-2.5" />
                              Flood zone
                            </Badge>
                          )}
                          {row.heritageFlag && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-amber-500 text-amber-700 dark:text-amber-400 gap-0.5">
                              <Landmark className="h-2.5 w-2.5" />
                              Heritage
                            </Badge>
                          )}
                          {row.biodiversityFlag && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-green-500 text-green-700 dark:text-green-400 gap-0.5">
                              <Leaf className="h-2.5 w-2.5" />
                              Biodiversity
                            </Badge>
                          )}
                          {row.acidSulfateClass && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-yellow-500 text-yellow-700 dark:text-yellow-400 gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              ASS {row.acidSulfateClass}
                            </Badge>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {domLabel(dom)}
                      </p>
                     {!isTeaser && row.listingUrl && (
                       <Button asChild size="sm" variant="outline" className="mt-auto gap-1.5">
                          <a href={row.listingUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                           View on realestate.com.au <ExternalLink className="h-3.5 w-3.5" />
                         </a>
                       </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Pagination — only shown to authenticated users */}
            {!showGate && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || browse.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || browse.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
            {/* Sign-up gate prompt — shown to unauthenticated visitors after the teaser cards */}
            {showGate && browse.data && browse.data.rows.length > TEASER_COUNT && (
              <div className="relative -mt-2">
                {/* Gradient fade over the blurred cards */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-32 left-0 right-0 h-40 z-10"
                  style={{
                    background: "linear-gradient(to bottom, transparent, var(--background) 85%)",
                  }}
                />
                {/* Gate card */}
                <div className="relative z-20 rounded-2xl border bg-card shadow-xl px-8 py-10 text-center max-w-lg mx-auto">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto mb-4">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Sign up free to see all{" "}
                    {stats.data
                      ? `${(stats.data.subdividable + stats.data.marginal).toLocaleString()}+`
                      : "1,600+"}{" "}
                    subdivision opportunities
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    You've seen 5 of the top-ranked listings. Create a free account to unlock the
                    full catalogue — every confirmed investment opportunity, updated nightly.
                    Currently covering NSW and Queensland.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      size="lg"
                      className="gap-2"
                      onClick={() => startLogin()}
                    >
                      <UserPlus className="h-4 w-4" />
                      Sign up free
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => startLogin()}
                    >
                      Sign in
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Free during early access · No credit card required
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
import { Link, useLocation } from "wouter";
