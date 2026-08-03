import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  ALL_INVESTMENT_TAGS,
  INVESTMENT_TAG_COLORS,
  INVESTMENT_TAG_DESCRIPTIONS,
  INVESTMENT_TAG_LABELS,
  type InvestmentTag,
} from "@/lib/investmentTags";
import {
  formatLandFilterConversion,
  parseLandSizeFilter,
  parsePriceFilter,
} from "@/lib/catalogueFilterParsing";
import { zoneChipClasses } from "@/lib/zones";
import { DiscoveryMethodology } from "@/components/DiscoveryMethodology";
import { ArrowLeft, ArrowRight, Building2, Filter, Lock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";

const TEASER_COUNT = 5;
const PAGE_SIZE = 24;

interface NicheFilterState {
  minPrice: string;
  maxPrice: string;
  minLand: string;
}

const DEFAULT_FILTERS: NicheFilterState = { minPrice: "", maxPrice: "", minLand: "" };

export default function NicheCategory() {
  const { tag } = useParams<{ tag: string }>();
  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "score" | "price_asc" | "price_desc">("newest");
  const [draft, setDraft] = useState<NicheFilterState>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<NicheFilterState>(DEFAULT_FILTERS);

  const validTag = ALL_INVESTMENT_TAGS.includes(tag as InvestmentTag)
    ? (tag as InvestmentTag)
    : null;

  const isAuthenticated = !authLoading && !!user;
  const showGate = !authLoading && !user;

  const draftMinPrice = parsePriceFilter(draft.minPrice);
  const draftMaxPrice = parsePriceFilter(draft.maxPrice);
  const draftMinLand = parseLandSizeFilter(draft.minLand);
  const priceRangeError =
    draftMinPrice.value !== undefined &&
    draftMaxPrice.value !== undefined &&
    draftMinPrice.value > draftMaxPrice.value
      ? "Minimum price cannot be higher than maximum price."
      : null;
  const hasInvalidFilter = Boolean(
    draftMinPrice.error || draftMaxPrice.error || draftMinLand.error || priceRangeError,
  );
  const isDirty =
    draft.minPrice.trim() !== applied.minPrice.trim() ||
    draft.maxPrice.trim() !== applied.maxPrice.trim() ||
    draft.minLand.trim() !== applied.minLand.trim();

  const queryInput = useMemo(
    () => ({
      tag: validTag!,
      page,
      pageSize: authLoading ? PAGE_SIZE : showGate ? TEASER_COUNT + 1 : PAGE_SIZE,
      sort,
      minPrice: parsePriceFilter(applied.minPrice).value,
      maxPrice: parsePriceFilter(applied.maxPrice).value,
      minLandAreaSqm: parseLandSizeFilter(applied.minLand).value,
    }),
    [validTag, page, authLoading, showGate, sort, applied],
  );

  const { data, isLoading } = trpc.catalogue.browseByTag.useQuery(
    queryInput,
    { enabled: !!validTag, staleTime: 60_000, refetchOnWindowFocus: false },
  );

  const applyFilters = () => {
    if (hasInvalidFilter) return;
    setApplied({ ...draft });
    setPage(1);
  };

  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setPage(1);
  };

  if (!validTag) {
    return (
      <AppShell>
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Category not found.</p>
          <Link href="/">
            <Button variant="outline" className="mt-4">Back to home</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const label = INVESTMENT_TAG_LABELS[validTag];
  const desc = INVESTMENT_TAG_DESCRIPTIONS[validTag];
  const chipClass = INVESTMENT_TAG_COLORS[validTag];
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const teaserRows = showGate ? rows.slice(0, TEASER_COUNT) : rows;
  const gatedRows = showGate ? rows.slice(TEASER_COUNT) : [];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppShell>
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-8">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </button>
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold mb-3 ${chipClass}`}>
                {label}
              </span>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                {label}
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">{desc}</p>
            </div>
            {total > 0 && (
              <div className="rounded-xl border bg-secondary/50 px-5 py-3 text-center shrink-0">
                <div className="text-2xl font-bold text-foreground">{total.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-0.5">active listings</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container py-8">
        <DiscoveryMethodology category={validTag} className="mb-5" />

        <form
          className="mb-5 rounded-xl border bg-card p-4 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Filter this category</h2>
            <span className="text-xs text-muted-foreground">Changes apply only when you click Apply filters.</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="niche-min-price" className="text-xs text-muted-foreground">Minimum price</Label>
              <Input
                id="niche-min-price"
                value={draft.minPrice}
                onChange={(event) => setDraft((current) => ({ ...current, minPrice: event.target.value }))}
                inputMode="decimal"
                placeholder="e.g. $200,000"
                aria-invalid={Boolean(draftMinPrice.error || priceRangeError)}
              />
              {draftMinPrice.error && <p className="text-[11px] text-destructive">{draftMinPrice.error}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="niche-max-price" className="text-xs text-muted-foreground">Maximum price</Label>
              <Input
                id="niche-max-price"
                value={draft.maxPrice}
                onChange={(event) => setDraft((current) => ({ ...current, maxPrice: event.target.value }))}
                inputMode="decimal"
                placeholder="e.g. $1,000,000"
                aria-invalid={Boolean(draftMaxPrice.error || priceRangeError)}
              />
              {draftMaxPrice.error && <p className="text-[11px] text-destructive">{draftMaxPrice.error}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="niche-min-land" className="text-xs text-muted-foreground">Minimum land size</Label>
              <Input
                id="niche-min-land"
                value={draft.minLand}
                onChange={(event) => setDraft((current) => ({ ...current, minLand: event.target.value }))}
                inputMode="decimal"
                placeholder="e.g. 2 acres or 8,000 sqm"
                aria-invalid={Boolean(draftMinLand.error)}
              />
              {draftMinLand.error ? (
                <p className="text-[11px] text-destructive">{draftMinLand.error}</p>
              ) : formatLandFilterConversion(draftMinLand.value) ? (
                <p className="text-[11px] text-muted-foreground">{formatLandFilterConversion(draftMinLand.value)}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Accepts sqm or acres, up to 500 acres.</p>
              )}
            </div>
          </div>
          {priceRangeError && <p className="mt-2 text-xs text-destructive">{priceRangeError}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" className="gap-1.5" disabled={hasInvalidFilter}>
              <Search className="h-3.5 w-3.5" /> Apply filters
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>Reset</Button>
            {isDirty && (
              <span className="text-xs text-amber-700">Changes not applied yet.</span>
            )}
          </div>
        </form>

        {/* Sort bar */}
        {isAuthenticated && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Sort:</span>
            {(["newest", "score", "price_asc", "price_desc"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setSort(s); setPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  sort === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {s === "newest" ? "Newest" : s === "score" ? "Best score" : s === "price_asc" ? "Price ↑" : "Price ↓"}
              </button>
            ))}
          </div>
        )}

        {/* Card grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl border bg-card animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            No listings match the current category filters.
          </div>
        ) : (
          <div className="relative">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teaserRows.map((row) => (
                <NicheCard key={row.listingId} row={row} />
              ))}
              {gatedRows.map((row) => (
                <div key={row.listingId} className="relative">
                  <div className="blur-sm pointer-events-none select-none">
                    <NicheCard row={row} />
                  </div>
                </div>
              ))}
            </div>

            {/* Sign-up gate overlay */}
            {showGate && rows.length > TEASER_COUNT && (
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-8 pt-32"
                style={{ background: "linear-gradient(to bottom, transparent 0%, hsl(var(--background)) 40%)" }}>
                <div className="rounded-2xl border bg-card shadow-xl px-8 py-8 max-w-md w-full text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Sign up free to see all {total.toLocaleString()} {label.toLowerCase()} listings
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Free during early access. No credit card required.
                  </p>
                  <Button
                    size="lg"
                    className="w-full h-11"
                    onClick={() => startLogin()}
                  >
                    Sign up free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <button onClick={() => startLogin()} className="underline hover:text-foreground">
                      Sign in
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pagination — authenticated only */}
        {isAuthenticated && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function NicheCard({ row }: { row: Record<string, unknown> }) {
  const r = row as {
    id: number;
    listingId: string;
    address?: string | null;
    suburb?: string | null;
    postcode?: string | null;
    priceDisplay?: string | null;
    landAreaSqm?: string | number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    zoneCode?: string | null;
    verdict?: string | null;
    score?: number | null;
    imageUrl?: string | null;
    headline?: string | null;
    listedAt?: Date | string | null;
    firstSeenAt?: Date | string | null;
  };

  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(r.listedAt ?? r.firstSeenAt ?? Date.now()).getTime()) / 86_400_000),
  );
  const landArea = r.landAreaSqm ? Number(r.landAreaSqm) : null;

  return (
    <button
      type="button"
      onClick={() => { window.location.href = `/property/${r.id}`; }}
      className="group w-full rounded-xl border bg-card overflow-hidden text-left hover:shadow-md hover:border-primary/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={`View investment analysis for ${r.address ?? r.suburb ?? "property"}`}
    >
      {/* Image */}
      <div className="relative h-36 bg-secondary overflow-hidden">
        {r.imageUrl ? (
          <img
            src={r.imageUrl}
            alt={r.address ?? "Property"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <Building2 className="h-10 w-10" />
          </div>
        )}
        {r.zoneCode && (
          <span className={`absolute top-2 left-2 rounded-full border px-2 py-0.5 text-[10px] font-bold ${zoneChipClasses(r.zoneCode)}`}>
            {r.zoneCode}
          </span>
        )}
        {r.verdict === "subdividable" && (
          <span className="absolute top-2 right-2 rounded-full bg-emerald-500/90 text-white px-2 py-0.5 text-[10px] font-bold">
            Subdividable
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="font-semibold text-sm text-foreground truncate">
          {r.suburb ?? "AU"}{r.postcode ? ` ${r.postcode}` : ""}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.address ?? "—"}</p>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {r.priceDisplay && <span className="font-semibold text-foreground">{r.priceDisplay}</span>}
          {landArea && <span>{landArea.toLocaleString()} m²</span>}
          {r.bedrooms && <span>{r.bedrooms} bed</span>}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/70">
            {days === 0 ? "Listed today" : `${days}d on market`}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-primary group-hover:underline">
            View analysis <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </button>
  );
}
