import AppShell from "@/components/AppShell";
import AnalysisDialog from "@/components/AnalysisDialog";
import ResultsMap from "@/components/ResultsMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VERDICT_META, type Verdict } from "@/lib/analysis";
import { trpc } from "@/lib/trpc";
import { Bath, BedDouble, Car, Home, Landmark, LayoutGrid, Loader2, Map as MapIcon, MapPin, Mountain, Ruler, Scale, Search } from "lucide-react";
import { Radar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Scope = "suburb" | "region" | "state";
type CategoryFilter = "all" | "cash_flow" | "land_only";

interface SearchFilters {
  location: string;
  scope?: Scope;
  regionId?: string;
  priceMin?: number;
  priceMax?: number;
  landSizeMin?: number;
  category?: CategoryFilter;
}

interface QuickVerdict {
  verdict: Verdict;
  potentialLots?: number | null;
  minLotSizeLabel?: string | null;
  zoneCode?: string | null;
  score?: number;
}

const CATEGORY_META: Record<string, { label: string; className: string; icon: typeof Home }> = {
  cash_flow: {
    label: "Cash flow",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    icon: Home,
  },
  land_only: {
    label: "Land only",
    className: "bg-stone-100 text-stone-700 border-stone-300",
    icon: Mountain,
  },
};

export default function Research() {
  const [location, setLocation] = useState("");
  const [scope, setScope] = useState<Scope>("suburb");
  const [regionId, setRegionId] = useState<string>("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [landSizeMin, setLandSizeMin] = useState("700");
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const [page, setPage] = useState(1);
  const [lastFilters, setLastFilters] = useState<SearchFilters | null>(null);
  const [analysingId, setAnalysingId] = useState<number | null>(null);
  const [verdicts, setVerdicts] = useState<Record<number, QuickVerdict>>({});
  const [view, setView] = useState<"grid" | "map">("grid");
  const [ranked, setRanked] = useState(true);
  const [deepScan, setDeepScan] = useState(false);

  const quickAnalyse = trpc.property.quickAnalyse.useMutation({
    onSuccess: rows => {
      setVerdicts(prev => {
        const next = { ...prev };
        for (const row of rows) next[row.id] = row as QuickVerdict;
        return next;
      });
    },
  });

  const rankedScan = trpc.property.rankedScan.useMutation({
    onSuccess: res => {
      setVerdicts(prev => {
        const next = { ...prev };
        for (const r of res.results) {
          next[r.id] = {
            verdict: r.verdict as Verdict,
            potentialLots: r.potentialLots,
            minLotSizeLabel: r.minLotSizeLabel,
            zoneCode: r.zoneCode,
            score: r.score,
          };
        }
        return next;
      });
      setDeepScan(true);
      toast.success(
        `Scan complete — ${res.analysedCount} analysed, ${res.keptCount} confirmed candidates`,
      );
    },
    onError: err => toast.error(`Deep scan failed: ${err.message}`),
  });

  const searchMutation = trpc.property.search.useMutation({
    onSuccess: res => {
      const targets = res.searchResults
        .filter(l => l.geoLocation)
        .map(l => ({
          id: l.id,
          latitude: l.geoLocation!.latitude,
          longitude: l.geoLocation!.longitude,
        }))
        .slice(0, 24);
      if (targets.length > 0) quickAnalyse.mutate({ listings: targets });
    },
    onError: err => toast.error(`Search failed: ${err.message}`),
  });
  const recentSearches = trpc.property.recentSearches.useQuery();
  const regions = trpc.property.regions.useQuery(undefined, { staleTime: Infinity });

  const runSearch = (filters: SearchFilters, newPage = 1) => {
    setLastFilters(filters);
    setPage(newPage);
    setDeepScan(false);
    rankedScan.reset();
    searchMutation.mutate({ ...filters, page: newPage });
    // Viability-first: automatically run the full analysis scan on new
    // searches (page 1) so every shown result carries a real verdict.
    if (newPage === 1) rankedScan.mutate({ ...filters, includeUnverified });
  };

  const runDeepScan = () => {
    if (!lastFilters) return;
    rankedScan.mutate({ ...lastFilters, includeUnverified });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scope === "suburb" && location.trim().length < 2) {
      toast.error("Enter a suburb or postcode, e.g. Dubbo NSW 2830");
      return;
    }
    if (scope === "region" && !regionId) {
      toast.error("Choose a region to search");
      return;
    }
    runSearch({
      location: scope === "suburb" ? location.trim() : scope === "region" ? (regions.data?.find(r => r.id === regionId)?.label ?? "Region") : "NSW",
      scope,
      regionId: scope === "region" ? regionId : undefined,
      category,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      landSizeMin: landSizeMin ? Number(landSizeMin) : undefined,
    });
  };

  // While the auto ranked-scan is running, keep the skeleton state rather than
  // briefly flashing raw unanalysed listings (viability-first UX).
  const scanning = searchMutation.isPending || rankedScan.isPending;
  const results = deepScan && rankedScan.data
    ? {
        total: rankedScan.data.total,
        nextPage: false,
        searchResults: rankedScan.data.results,
        scopeLabel: `${rankedScan.data.scopeLabel} — ${rankedScan.data.analysedCount} analysed, ${rankedScan.data.keptCount} viable`,
      }
    : searchMutation.data;

  return (
    <AppShell>
      <div className="container py-8">
        <h1 className="text-2xl font-semibold text-foreground">Property research</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search listings for sale, then analyse any property against official planning data. Currently covering NSW.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={scope} onValueChange={v => setScope(v as Scope)}>
              <TabsList className="h-9">
                <TabsTrigger value="suburb" className="text-xs px-3">Suburb / postcode</TabsTrigger>
                <TabsTrigger value="region" className="text-xs px-3">Region</TabsTrigger>
                <TabsTrigger value="state" className="text-xs px-3">All NSW (current)</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={category} onValueChange={v => setCategory(v as CategoryFilter)}>
              <SelectTrigger className="h-9 w-[190px] text-xs">
                <SelectValue placeholder="Opportunity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All opportunity types</SelectItem>
                <SelectItem value="cash_flow">Cash flow (has dwelling)</SelectItem>
                <SelectItem value="land_only">Land only (no dwelling)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_130px_130px_150px_auto]">
          {scope === "suburb" ? (
            <Input
              placeholder="Suburb or postcode — e.g. Dubbo NSW 2830"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          ) : scope === "region" ? (
            <Select value={regionId} onValueChange={setRegionId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a region…" />
              </SelectTrigger>
              <SelectContent>
                {(regions.data ?? []).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
              Scans all {regions.data?.length ?? 12} NSW regions in one pass (currently NSW)
            </div>
          )}
          <Input
            placeholder="Min price"
            type="number"
            min={0}
            value={priceMin}
            onChange={e => setPriceMin(e.target.value)}
          />
          <Input
            placeholder="Max price"
            type="number"
            min={0}
            value={priceMax}
            onChange={e => setPriceMax(e.target.value)}
          />
          <Input
            placeholder="Min land (m²)"
            type="number"
            min={0}
            value={landSizeMin}
            onChange={e => setLandSizeMin(e.target.value)}
          />
          <Button type="submit" disabled={searchMutation.isPending} className="gap-2">
            {searchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={includeUnverified} onCheckedChange={setIncludeUnverified} />
            Include unverified listings (no advertised land area — verdict unconfirmed)
          </label>
        </form>

        {!results && !scanning && (recentSearches.data?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Recent:</span>
            {recentSearches.data!.slice(0, 6).map(s => (
              <Button
                key={s.id}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setLocation(s.location);
                  runSearch({ location: s.location });
                }}
              >
                {s.location}
              </Button>
            ))}
          </div>
        )}

        {scanning && (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        )}

        {!results && !scanning && (
          <div className="mt-10 rounded-xl border border-dashed bg-muted/30 px-6 py-12">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mt-4 font-medium text-foreground">Search a suburb to begin</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Each result is checked against official planning layers so you can spot
                subdivision candidates at a glance.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3 text-left">
                <div className="rounded-lg border bg-background p-4">
                  <Ruler className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-sm font-medium text-foreground">Minimum lot size</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pulled live from the NSW Planning Portal Lot Size layer at the parcel's coordinates. (NSW only)
                  </p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <Landmark className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-sm font-medium text-foreground">Zoning check</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Restricted zones (conservation, waterways, special purpose) are flagged automatically.
                  </p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <Scale className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-sm font-medium text-foreground">Yield verdict</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Land area ÷ minimum lot size, with marginal cases flagged for dual-occupancy pathways.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {results && !scanning && (
          <>
            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {results.total.toLocaleString()} listings found
                {"scopeLabel" in results && results.scopeLabel ? ` in ${results.scopeLabel}` : ""} · page {page}
                {category !== "all" ? ` · showing ${category === "cash_flow" ? "cash-flow" : "land-only"} only` : ""}
              </p>
              <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={runDeepScan}
                disabled={rankedScan.isPending || !lastFilters}
              >
                {rankedScan.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Radar className="h-3.5 w-3.5" />
                )}
                {rankedScan.isPending ? "Analysing all listings…" : deepScan && rankedScan.data ? "Re-scan" : "Deep scan (analyse all)"}
              </Button>
              <Button
                variant={ranked ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setRanked(r => !r)}
              >
                <Scale className="h-3.5 w-3.5" />
                {ranked ? "Ranked by potential" : "Rank by potential"}
              </Button>
              <Tabs value={view} onValueChange={v => setView(v as "grid" | "map")}>
                <TabsList className="h-8">
                  <TabsTrigger value="grid" className="gap-1 text-xs px-2.5">
                    <LayoutGrid className="h-3.5 w-3.5" /> Grid
                  </TabsTrigger>
                  <TabsTrigger value="map" className="gap-1 text-xs px-2.5">
                    <MapIcon className="h-3.5 w-3.5" /> Map
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              </div>
            </div>

            {view === "map" && (
              <div className="mt-4">
                <ResultsMap
                  listings={results.searchResults
                    .filter(l => l.geoLocation)
                    .map(l => ({
                      id: l.id,
                      address: l.address?.full ?? l.headline ?? "Listing",
                      price: l.price,
                      latitude: l.geoLocation!.latitude,
                      longitude: l.geoLocation!.longitude,
                      verdict: verdicts[l.id]?.verdict,
                    }))}
                  onSelect={id => setAnalysingId(id)}
                />
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600 mr-1" />Subdividable</span>
                  <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-600 mr-1" />Marginal</span>
                  <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-600 mr-1" />Not subdividable</span>
                  <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500 mr-1" />Needs data · click a marker to analyse</span>
                </div>
              </div>
            )}

            <div className={view === "grid" ? "mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "hidden"}>
              {(ranked
                ? [...results.searchResults].sort(
                    (a, b) => (verdicts[b.id]?.score ?? -1) - (verdicts[a.id]?.score ?? -1),
                  )
                : results.searchResults
              ).map(listing => {
                const qv = verdicts[listing.id];
                const qvMeta = qv ? VERDICT_META[qv.verdict] : null;
                return (
                <Card key={listing.id} className="overflow-hidden flex flex-col">
                  <div className="relative">
                    {listing.photos?.[0] ? (
                      <img
                        src={listing.photos[0]}
                        alt={listing.address?.full ?? "Property"}
                        className="h-44 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-44 w-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                        No photo
                      </div>
                    )}
                    {qvMeta ? (
                      <Badge className={`absolute top-2 left-2 border ${qvMeta.className}`}>
                        {qvMeta.label}
                        {qv?.verdict === "subdividable" && qv.potentialLots
                          ? ` · ${qv.potentialLots} lots`
                          : ""}
                      </Badge>
                    ) : quickAnalyse.isPending ? (
                      <Badge variant="secondary" className="absolute top-2 left-2 gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Checking
                      </Badge>
                    ) : null}
                    {ranked && qv?.score !== undefined && qv.score > 0 && (
                      <Badge variant="secondary" className="absolute top-2 right-2 bg-background/90">
                        Score {qv.score}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="pt-4 flex-1 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground leading-snug">
                        {listing.address?.full ?? listing.headline}
                      </p>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {"category" in listing && listing.category && CATEGORY_META[listing.category as string] && (
                          <Badge className={`border ${CATEGORY_META[listing.category as string]!.className}`}>
                            {CATEGORY_META[listing.category as string]!.label}
                          </Badge>
                        )}
                        {listing.propertyType && (
                          <Badge variant="secondary">{listing.propertyType}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-primary">{listing.price ?? "Price on request"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {listing.bedrooms !== undefined && (
                        <span className="flex items-center gap-1">
                          <BedDouble className="h-3.5 w-3.5" /> {listing.bedrooms}
                        </span>
                      )}
                      {listing.bathrooms !== undefined && (
                        <span className="flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" /> {listing.bathrooms}
                        </span>
                      )}
                      {listing.carspaces !== undefined && (
                        <span className="flex items-center gap-1">
                          <Car className="h-3.5 w-3.5" /> {listing.carspaces}
                        </span>
                      )}
                      {listing.address?.suburb && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {listing.address.suburb}
                        </span>
                      )}
                    </div>
                    {qv?.minLotSizeLabel && (
                      <p className="text-xs text-muted-foreground">
                        Min lot: {qv.minLotSizeLabel}
                        {qv.zoneCode ? ` · Zone ${qv.zoneCode}` : ""}
                      </p>
                    )}
                    <Button
                      className="mt-auto"
                      variant="default"
                      size="sm"
                      onClick={() => setAnalysingId(listing.id)}
                    >
                      Analyse subdivision potential
                    </Button>
                  </CardContent>
                </Card>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              {!deepScan && (
              <>
              <Button
                variant="outline"
                disabled={page <= 1 || searchMutation.isPending}
                onClick={() => lastFilters && runSearch(lastFilters, page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!results.nextPage || searchMutation.isPending}
                onClick={() => lastFilters && runSearch(lastFilters, page + 1)}
              >
                Next page
              </Button>
              </>
              )}
              {deepScan && rankedScan.data && (
                <p className="text-xs text-muted-foreground">
                  Deep scan shows the top {rankedScan.data.analysedCount} listings ranked by subdivision score.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <AnalysisDialog listingId={analysingId} onClose={() => setAnalysingId(null)} />
    </AppShell>
  );
}
