import { useParams, Link } from "wouter";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { CatalogueListing } from "../../../drizzle/schema";
import {
  AlertTriangle,
  ArrowLeft,
  Bath,
  BedDouble,
  BookmarkCheck,
  BookmarkPlus,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Droplets,
  ExternalLink,
  Flame,
  Home,
  Info,
  Landmark,
  Layers,
  Leaf,
  MapPin,
  Ruler,
  ShieldAlert,
  TrendingUp,
  XCircle,
  HelpCircle,
  BarChart3,
  DollarSign,
  Key,
  Scale,
  Gavel,
  Clipboard,
  ClipboardCheck,
  Printer,
} from "lucide-react";
import {
  INVESTMENT_TAG_COLORS,
  INVESTMENT_TAG_LABELS,
  parseTags,
  type InvestmentTag,
} from "@/lib/investmentTags";
import {
  buildDualIncomeScenario,
  buildRentalYieldScenario,
  describeCampaignUrgency,
  estimateDevelopmentPotential,
} from "@/lib/investmentAnalysis";

// ── Comparable listings component ──────────────────────────────────────────────
// ── Suburb median comparison component ────────────────────────────────────────
function SuburbMedianCard({ listing }: { listing: CatalogueListing }) {
  const { data: stats, isLoading } = trpc.catalogue.getSuburbStats.useQuery(
    { suburb: listing.suburb ?? "", postcode: listing.postcode ?? undefined },
    { enabled: Boolean(listing.suburb), staleTime: 300_000, refetchOnWindowFocus: false },
  );
  const price = listing.priceNumeric ? Number(listing.priceNumeric) : null;
  if (!listing.suburb) return null;
  if (isLoading) return <div className="h-20 bg-muted animate-pulse rounded-lg" />;
  if (!stats) return (
    <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      No price data available for {listing.suburb} suburb comparison.
    </div>
  );
  const discount = price && stats.median ? Math.round(((stats.median - price) / stats.median) * 100) : null;
  const fmt = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-amber-600" /> Suburb median comparison — {listing.suburb}
      </h3>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">Suburb median (active)</p>
          <p className="text-base font-bold text-foreground">{fmt(stats.median)}</p>
          <p className="text-xs text-muted-foreground">{stats.count} listings</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">This listing</p>
          <p className="text-base font-bold text-foreground">{price ? fmt(price) : "POA"}</p>
        </div>
        {discount !== null && (
          <div className={`rounded-lg px-3 py-2 ${discount > 0 ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800"}`}>
            <p className="text-xs text-muted-foreground mb-0.5">vs median</p>
            <p className={`text-base font-bold ${discount > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {discount > 0 ? `${discount}% below` : `${Math.abs(discount)}% above`}
            </p>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Based on {stats.count} active listings in {listing.suburb}. Active listings only — not sold data.</p>
    </div>
  );
}

function ComparableListings({ suburb, excludeId, postcode }: {
  suburb: string;
  excludeId: number;
  postcode?: string | null;
}) {
  const { data: comps, isLoading } = trpc.catalogue.getComparables.useQuery(
    { suburb, excludeId, postcode: postcode ?? undefined },
    { staleTime: 300_000, refetchOnWindowFocus: false },
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
      </div>
    );
  }

  if (!comps || comps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No other active listings found in {suburb} right now.</p>
    );
  }

  return (
    <div className="space-y-2">
      {comps.map((comp) => {
        const dom = comp.listedAt
          ? Math.floor((Date.now() - new Date(comp.listedAt).getTime()) / 86_400_000)
          : comp.firstSeenAt
          ? Math.floor((Date.now() - new Date(comp.firstSeenAt).getTime()) / 86_400_000)
          : null;
        return (
          <a
            key={comp.id}
            href={comp.listingUrl ?? `/property/${comp.id}`}
            target={comp.listingUrl ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors group"
          >
            {comp.imageUrl && (
              <img src={comp.imageUrl} alt="" className="h-12 w-16 object-cover rounded-md flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{comp.address ?? comp.suburb}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {comp.priceDisplay && <span className="font-medium text-foreground">{comp.priceDisplay}</span>}
                {comp.bedrooms && <span>{comp.bedrooms}bd</span>}
                {comp.landAreaSqm && <span>{Math.round(Number(comp.landAreaSqm)).toLocaleString()} m²</span>}
                {dom !== null && <span>{dom}d on market</span>}
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        );
      })}
      <p className="text-xs text-muted-foreground pt-1">Active listings in {suburb} — not sold comparables. Sold data coming soon.</p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSqm(sqm: number): string {
  if (sqm >= 10_000) return `${(sqm / 10_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`;
  return `${Math.round(sqm).toLocaleString()} m²`;
}

function formatAud(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency", currency: "AUD", maximumFractionDigits: 0,
  }).format(n);
}

function daysOnMarket(
  listedAt: Date | string | null | undefined,
  firstSeenAt: Date | string,
): number | null {
  const ref = listedAt ?? firstSeenAt;
  if (!ref) return null;
  const ms = Date.now() - new Date(ref).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-28 h-28 shrink-0">
      <svg width="112" height="112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-foreground leading-none">{score}</span>
        <span className="text-xs text-muted-foreground mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

type RiskLevel = "clear" | "warning" | "danger" | "unknown";
function RiskRow({ icon, label, level, detail }: {
  icon: React.ReactNode; label: string; level: RiskLevel; detail?: string | null;
}) {
  const cfg: Record<RiskLevel, { bg: string; text: string; dot: string; badge: string }> = {
    clear:   { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", badge: "Clear" },
    warning: { bg: "bg-amber-50 dark:bg-amber-950/30",     text: "text-amber-700 dark:text-amber-300",     dot: "bg-amber-500",   badge: "Warning" },
    danger:  { bg: "bg-red-50 dark:bg-red-950/30",         text: "text-red-700 dark:text-red-300",         dot: "bg-red-500",     badge: "Flagged" },
    unknown: { bg: "bg-muted/40",                           text: "text-muted-foreground",                  dot: "bg-muted-foreground/40", badge: "Unknown" },
  };
  const c = cfg[level];
  return (
    <div className={`flex items-start gap-3 rounded-lg px-4 py-3 ${c.bg}`}>
      <span className={`mt-0.5 ${c.text}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground">{label}</span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${c.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            {c.badge}
          </span>
        </div>
        {detail && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{detail}</p>}
      </div>
    </div>
  );
}

function PlanRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-foreground">{value}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function ComingSoonCard({ title, icon, description }: {
  title: string; icon: React.ReactNode; description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant="secondary" className="text-xs ml-auto">Coming soon</Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// ── Zone descriptions ──────────────────────────────────────────────────────────
const ZONE_DESCRIPTIONS: Record<string, string> = {
  R1: "General Residential — medium-density housing, flats, boarding houses.",
  R2: "Low Density Residential — houses, dual occupancy, secondary dwellings.",
  R3: "Medium Density Residential — townhouses, multi-dwelling housing.",
  R4: "High Density Residential — residential flat buildings.",
  R5: "Large Lot Residential — rural-residential lifestyle blocks.",
  RU1: "Primary Production — broad-acre farming, rural uses.",
  RU2: "Rural Landscape — scenic/rural areas, limited residential.",
  RU4: "Primary Production Small Lots — small-scale rural production.",
  RU5: "Village — small village communities.",
  RU6: "Transition — buffer between rural and urban zones.",
  E1: "Local Centre — small-scale retail and commercial.",
  E2: "Commercial Centre — medium-scale commercial.",
  E3: "Productivity Support — industrial and business support.",
  E4: "General Industrial — heavy and light industrial.",
  MU1: "Mixed Use — residential, retail, and commercial mix.",
  SP1: "Special Activities — airports, hospitals, schools.",
  SP2: "Infrastructure — roads, utilities, public infrastructure.",
  RE1: "Public Recreation — parks, ovals, public open space.",
  RE2: "Private Recreation — private sporting/recreation facilities.",
  W1: "Natural Waterways — rivers, creeks, wetlands.",
  W2: "Recreational Waterways — boating, swimming areas.",
  C1: "Environmental Protection — sensitive ecological areas.",
  C2: "Environmental Conservation — conservation areas.",
  C3: "Environmental Management — managed environmental areas.",
  C4: "Environmental Living — low-impact rural residential.",
};

// Zones that permit secondary dwellings / dual occupancy
const SECONDARY_DWELLING_ZONES = ["R1", "R2", "R3", "R4", "R5", "RU5"];

function PlanningMetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  tone?: "default" | "clear" | "flagged" | "unknown";
}) {
  const toneClass = {
    default: "border-border bg-background/80",
    clear: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/25",
    flagged: "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/25",
    unknown: "border-border bg-muted/30",
  }[tone];
  const valueClass = tone === "flagged"
    ? "text-amber-800 dark:text-amber-300"
    : tone === "clear"
      ? "text-emerald-800 dark:text-emerald-300"
      : "text-foreground";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold leading-tight ${valueClass}`}>{value}</p>
      {detail && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>}
    </div>
  );
}

function PlanningPortalSection({
  listing,
  prominent = false,
}: {
  listing: CatalogueListing;
  prominent?: boolean;
}) {
  const isQld = listing.state === "QLD";
  const land = listing.landAreaSqm ? Number(listing.landAreaSqm) : null;
  const mls = listing.minLotSizeSqm ? Number(listing.minLotSizeSqm) : null;
  const zoneDescription = listing.zoneCode
    ? isQld
      ? "Queensland zone-purpose signal only. Subdivision, density and use entitlements remain council-scheme specific."
      : ZONE_DESCRIPTIONS[listing.zoneCode] ?? "Refer to the applicable Local Environmental Plan for permitted uses."
    : null;
  const hasCoordinates = Boolean(listing.latitude && listing.longitude);

  const mappedRisk = (
    flaggedValue: string | null,
    clearText: string,
  ): { value: string; detail: string; tone: "clear" | "flagged" | "unknown" } => {
    if (flaggedValue) {
      return { value: flaggedValue, detail: "Mapped constraint detected — verify the applicable overlay and controls.", tone: "flagged" };
    }
    if (hasCoordinates && !isQld) {
      return { value: "Not flagged", detail: clearText, tone: "clear" };
    }
    return {
      value: "Not captured",
      detail: isQld
        ? "No conclusive council-machine result is stored; verify the official QLD and council maps."
        : "Coordinates were unavailable for spatial overlay screening.",
      tone: "unknown",
    };
  };

  const bushfire = mappedRisk(
    listing.bushfireCategory,
    "No bushfire-prone-land category is stored for this coordinate.",
  );
  const flood = mappedRisk(
    listing.floodRisk === "flagged" ? "Flood planning area" : null,
    "No flood-planning-area flag is stored for this coordinate.",
  );
  const heritage = mappedRisk(
    listing.heritageFlag,
    "No heritage item or conservation-area flag is stored for this coordinate.",
  );
  const biodiversity = mappedRisk(
    listing.biodiversityFlag === "flagged" ? "Biodiversity Values Map" : null,
    "No Biodiversity Values Map flag is stored for this coordinate.",
  );
  const acidSulfate = mappedRisk(
    listing.acidSulfateClass ? `Class ${listing.acidSulfateClass}` : null,
    "No acid sulfate soils class is stored for this coordinate.",
  );

  return (
    <section className={`rounded-2xl border bg-card p-5 sm:p-6 ${prominent ? "border-primary/40 shadow-sm ring-1 ring-primary/10" : ""}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {isQld ? "Queensland spatial screening" : "NSW spatial screening"}
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Layers className="h-5 w-5 text-primary" />
            {isQld ? "QLD council and state spatial data" : "NSW Planning Portal data"}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Stored planning controls and mapped constraints for this listing. “Not captured” means the database has no value; it is not a planning clearance.
          </p>
        </div>
        {prominent && (
          <Badge className="border border-primary/25 bg-primary/10 text-primary hover:bg-primary/10">
            Priority due diligence
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <PlanningMetricCard
          label={isQld ? "Zone / precinct" : "Zoning code"}
          value={listing.zoneCode ?? "Not captured"}
          detail={zoneDescription ?? "No zoning code is stored for this listing."}
          tone={listing.zoneCode ? "default" : "unknown"}
        />
        <PlanningMetricCard
          label="Minimum lot size"
          value={mls ? formatSqm(mls) : "Not captured"}
          detail={listing.minLotSizeLabel ?? (isQld
            ? "Council-specific minimum-lot control is not captured; manual scheme review is required."
            : "LEP minimum-lot-size layer.")}
          tone={mls ? "default" : "unknown"}
        />
        <PlanningMetricCard
          label="Lot width / frontage"
          value={listing.frontageM ? `${Number(listing.frontageM).toLocaleString()} m` : "Not captured"}
          detail={listing.frontageM ? "Stored frontage parsed from listing information." : "No frontage value is stored."}
          tone={listing.frontageM ? "default" : "unknown"}
        />
        <PlanningMetricCard
          label="Floor space ratio"
          value={listing.fsrValue ? `${Number(listing.fsrValue).toLocaleString()}:1` : "Not captured"}
          detail={isQld ? "Council planning-scheme density control where machine-readable and available." : "Maximum FSR from the applicable LEP map where available."}
          tone={listing.fsrValue ? "default" : "unknown"}
        />
        <PlanningMetricCard
          label="Height of buildings"
          value={listing.maxBuildingHeightM ? `${Number(listing.maxBuildingHeightM).toLocaleString()} m` : "Not captured"}
          detail={isQld ? "Council planning-scheme height control where machine-readable and available." : "Maximum building height from the applicable LEP map where available."}
          tone={listing.maxBuildingHeightM ? "default" : "unknown"}
        />
        <PlanningMetricCard
          label="Site area"
          value={land ? formatSqm(land) : "Not captured"}
          detail={listing.lgaName ? `${listing.lgaName} local government area.` : "Stored listing land area."}
          tone={land ? "default" : "unknown"}
        />
      </div>

      <div className="mt-5 border-t pt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mapped constraints</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <PlanningMetricCard label="Bushfire prone land" {...bushfire} />
          <PlanningMetricCard label="Flood planning" {...flood} />
          <PlanningMetricCard label="Heritage" {...heritage} />
          <PlanningMetricCard label="Biodiversity" {...biodiversity} />
          <PlanningMetricCard label="Acid sulfate soils" {...acidSulfate} />
        </div>
      </div>

      <p className="mt-5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        {isQld
          ? "QLD zone names describe broad planning purposes, not uniform statewide entitlements. Confirm the current council planning scheme, zone/precinct, overlays, minimum lot controls, servicing and development assessment requirements before acting. ‘Not captured’ is not a clearance."
          : "Screening data is stored from NSW planning and spatial layers. Confirm the current LEP, DCP, certificates, overlays, and development controls with council before acting."}
      </p>
    </section>
  );
}

// ── Category-adaptive section components ──────────────────────────────────────

function SubdivisionSection({ listing }: { listing: CatalogueListing }) {
  const isQld = listing.state === "QLD";
  const land = listing.landAreaSqm ? Number(listing.landAreaSqm) : null;
  const mls = listing.minLotSizeSqm ? Number(listing.minLotSizeSqm) : null;
  const landToLotRatio = land && mls ? land / mls : null;
  const priceNum = listing.priceNumeric ? Number(listing.priceNumeric) : null;
  const ppl = priceNum && listing.potentialLots && listing.potentialLots > 1
    ? priceNum / listing.potentialLots : null;

  const signals: { label: string; ok: boolean; unknown?: boolean; detail: string }[] = [];
  if (land !== null && mls !== null) {
    const ratio = land / mls;
    signals.push({
      label: "Land ÷ min lot size",
      ok: ratio >= 2,
      detail: `${formatSqm(land)} ÷ ${formatSqm(mls)} = ${ratio.toFixed(1)}× — ${ratio >= 2 ? "fits 2+ lots" : "insufficient for subdivision"}`,
    });
  } else if (land !== null) {
    signals.push(isQld
      ? { label: "Land area recorded", ok: false, unknown: true, detail: `${formatSqm(land)} — council minimum-lot control is not captured; manual scheme review required` }
      : { label: "Land area recorded", ok: land >= 700, detail: `${formatSqm(land)} — ${land >= 700 ? "meets typical minimum" : "below typical 700 m² minimum"}` });
  }
  if (listing.potentialLots) {
    signals.push({
      label: "Estimated lot yield",
      ok: listing.potentialLots >= 2,
      detail: `${listing.potentialLots} lots from land ÷ min lot size calculation`,
    });
  }
  if (listing.zoneCode) {
    const ok = isQld
      ? /(residential|township|mixed use|centre)/i.test(listing.zoneCode)
      : ["R1","R2","R3","R4","R5","RU5"].includes(listing.zoneCode);
    signals.push(isQld
      ? { label: "QLD zone-purpose screen", ok, unknown: true, detail: `${listing.zoneCode} — ${ok ? "candidate zone family" : "not a common residential candidate family"}; subdivision assessment remains council-scheme specific` }
      : { label: "Zone supports subdivision", ok, detail: `${listing.zoneCode} — ${ok ? "residential zone, subdivision generally permitted" : "check if subdivision is permitted in this zone"}` });
  }
  if (listing.frontageM) {
    const fm = Number(listing.frontageM);
    signals.push(isQld
      ? { label: "Frontage", ok: false, unknown: true, detail: `${fm}m recorded — required width and access standards vary by council and development type` }
      : { label: "Frontage", ok: fm >= 15, detail: `${fm}m — ${fm >= 15 ? "meets typical 15m minimum" : "may be too narrow for some councils"}` });
  }
  if (listing.isNewBuild) {
    signals.push({ label: "New build flag", ok: false, detail: "New builds rarely have subdivision potential" });
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-card p-5 sm:p-6 dark:border-emerald-900">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Investment analysis</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
          <TrendingUp className="h-5 w-5 text-emerald-600" /> Subdivision potential
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PlanningMetricCard label="Subdivision score" value={`${listing.score ?? 0} / 100`} tone={(listing.score ?? 0) >= 65 ? "clear" : (listing.score ?? 0) > 0 ? "flagged" : "unknown"} />
        <PlanningMetricCard label="Estimated lot yield" value={listing.potentialLots ? `${listing.potentialLots} lots` : "Not calculated"} detail="Stored land-area ÷ minimum-lot-size screen." tone={listing.potentialLots && listing.potentialLots >= 2 ? "clear" : "unknown"} />
        <PlanningMetricCard label="Price per potential lot" value={ppl ? formatAud(ppl) : "Not calculated"} detail="Asking price ÷ estimated lots." tone={ppl ? "default" : "unknown"} />
        <PlanningMetricCard label="Land ÷ minimum lot size" value={landToLotRatio ? `${landToLotRatio.toFixed(1)}×` : "Not calculated"} detail={landToLotRatio ? `${formatSqm(land!)} ÷ ${formatSqm(mls!)}.` : "Requires stored land area and minimum lot size."} tone={landToLotRatio && landToLotRatio >= 2 ? "clear" : landToLotRatio ? "flagged" : "unknown"} />
      </div>
      <div className="mt-5 rounded-xl border bg-muted/20 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feasibility signals</h3>
        <div className="space-y-2.5">
          {signals.length > 0 ? signals.map((sig, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {sig.unknown
                ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                : sig.ok
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
              <div>
                <span className="font-medium text-foreground">{sig.label}</span>
                <p className="text-xs text-muted-foreground">{sig.detail}</p>
              </div>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">Score is based on land area, minimum lot size, zoning, and planning constraints. Full breakdown available once planning data is confirmed.</p>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        This is a catalogue screening result, not a subdivision approval. Confirm access, frontage, servicing, easements, overlays, lot shape, minimum dimensions, and council controls before relying on the estimated lot yield.
      </p>
    </section>
  );
}

function DevSiteSection({ listing }: { listing: CatalogueListing }) {
  const land = listing.landAreaSqm ? Number(listing.landAreaSqm) : null;
  const fsr = listing.fsrValue ? Number(listing.fsrValue) : null;
  const potential = estimateDevelopmentPotential(land, fsr);
  return (
    <section className="rounded-2xl border border-violet-200 bg-card p-5 sm:p-6 dark:border-violet-900">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Investment analysis</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Building2 className="h-5 w-5 text-violet-600" /> Development site potential
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <PlanningMetricCard label="Site area" value={land ? formatSqm(land) : "Not captured"} tone={land ? "default" : "unknown"} />
        <PlanningMetricCard label="Zoning" value={listing.zoneCode ?? "Not captured"} detail={listing.zoneCode ? ZONE_DESCRIPTIONS[listing.zoneCode] : undefined} tone={listing.zoneCode ? "default" : "unknown"} />
        <PlanningMetricCard label="Maximum FSR" value={fsr ? `${fsr.toLocaleString()}:1` : "Not captured"} tone={fsr ? "default" : "unknown"} />
        <PlanningMetricCard label="Height limit" value={listing.maxBuildingHeightM ? `${Number(listing.maxBuildingHeightM).toLocaleString()} m` : "Not captured"} tone={listing.maxBuildingHeightM ? "default" : "unknown"} />
        <PlanningMetricCard
          label="Indicative gross floor area"
          value={potential ? formatSqm(potential.estimatedGrossFloorAreaSqm) : "Cannot calculate"}
          detail={potential ? "Site area × stored maximum FSR." : "Requires both stored site area and FSR."}
          tone={potential ? "default" : "unknown"}
        />
        <PlanningMetricCard
          label="Indicative dwelling capacity"
          value={potential ? `${potential.indicativeDwellingCapacity} dwellings` : "Cannot calculate"}
          detail={potential ? `Screening only: gross floor area ÷ ${potential.assumedGrossAreaPerDwellingSqm} m² per dwelling.` : "No capacity estimate without site area and FSR."}
          tone={potential ? "default" : "unknown"}
        />
      </div>
      <p className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-xs leading-relaxed text-violet-800 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-300">
        The dwelling count is an early screening scenario only. It does not account for setbacks, parking, communal areas, deep-soil zones, access, servicing, design efficiency, affordable-housing rules, or council assessment.
      </p>
    </section>
  );
}

function PosGearedSection({ listing }: { listing: CatalogueListing }) {
  const price = listing.priceNumeric ? Number(listing.priceNumeric) : null;
  const scenario = buildRentalYieldScenario(price, listing.propertyType);

  return (
    <section className="rounded-2xl border border-emerald-200 bg-card p-5 sm:p-6 dark:border-emerald-900">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Investment analysis</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
          <TrendingUp className="h-5 w-5 text-emerald-600" /> Positive-geared yield screen
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">A transparent scenario derived from the stored asking price; the database does not contain a formal rental appraisal.</p>
      </div>
      {scenario ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <PlanningMetricCard
              label="Estimated weekly rent"
              value={`${formatAud(scenario.estimatedWeeklyRent)} / wk`}
              detail={`${scenario.assumedGrossYieldPct.toFixed(1)}% gross-yield scenario.`}
              tone="clear"
            />
            <PlanningMetricCard
              label="Estimated gross yield"
              value={`${scenario.assumedGrossYieldPct.toFixed(1)}%`}
              detail={`${formatAud(scenario.estimatedAnnualRent)} estimated annual rent.`}
            />
            <PlanningMetricCard
              label="Price ÷ annual rent"
              value={`${scenario.priceToRentRatio.toFixed(1)}×`}
              detail="Lower ratios generally indicate stronger gross income relative to price."
            />
            <PlanningMetricCard
              label="Estimated mortgage"
              value={`${formatAud(scenario.estimatedMortgageWeekly)} / wk`}
              detail="80% LVR, 6.5% principal-and-interest, 30 years."
            />
            <PlanningMetricCard
              label="Pre-expense cash flow"
              value={`${scenario.estimatedPreExpenseCashflowWeekly >= 0 ? "+" : "−"}${formatAud(Math.abs(scenario.estimatedPreExpenseCashflowWeekly))} / wk`}
              detail="Rent minus modelled mortgage only; excludes every property expense."
              tone={scenario.estimatedPreExpenseCashflowWeekly >= 0 ? "clear" : "flagged"}
            />
            <PlanningMetricCard
              label="Cash-flow status"
              value={scenario.estimatedPreExpenseCashflowWeekly >= 0 ? "Positive before expenses" : "Negative before expenses"}
              detail="Rates, strata, insurance, vacancy, maintenance, and management may materially change this result."
              tone={scenario.estimatedPreExpenseCashflowWeekly >= 0 ? "clear" : "flagged"}
            />
          </div>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
            Screening assumption only: obtain a local rental appraisal and enter full operating costs before assessing whether the property is genuinely positive geared.
          </p>
        </>
      ) : (
        <PlanningMetricCard
          label="Yield analysis"
          value="Cannot calculate"
          detail="The asking price is not stored as a numeric value, so rent, yield, price-to-rent, and cash-flow scenarios are unavailable."
          tone="unknown"
        />
      )}
    </section>
  );
}

function DeceasedEstateSection({ listing }: { listing: CatalogueListing }) {
  const dom = daysOnMarket(listing.listedAt, listing.firstSeenAt);
  const campaign = describeCampaignUrgency(dom);
  return (
    <section className="rounded-2xl border border-amber-200 bg-card p-5 sm:p-6 dark:border-amber-900">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Investment analysis</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Scale className="h-5 w-5 text-amber-600" /> Deceased estate opportunity screen
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <PlanningMetricCard
          label="Estate sale indicator"
          value={listing.hasEstateKeywords ? "Language detected" : "Category tag present"}
          detail={listing.hasEstateKeywords ? "The stored listing scan detected estate-related wording." : "The listing is tagged deceased estate, but the explicit keyword flag is not set."}
          tone="flagged"
        />
        <PlanningMetricCard
          label="Time on market"
          value={dom === null ? "Not captured" : dom === 0 ? "Listed today" : `${dom} days`}
          detail={campaign.detail}
          tone={campaign.tone === "urgent" ? "flagged" : dom === null ? "unknown" : "default"}
        />
        <PlanningMetricCard label="Asking price" value={listing.priceDisplay || "Not disclosed"} tone={listing.priceNumeric ? "default" : "unknown"} />
      </div>
      <div className="mt-5 space-y-3">
        <SuburbMedianCard listing={listing} />
        {listing.suburb && (
          <div className="rounded-xl border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-600" /> Active comparables in {listing.suburb}
            </h3>
            <ComparableListings suburb={listing.suburb} excludeId={listing.id} postcode={listing.postcode} />
          </div>
        )}
      </div>
      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
        Confirm probate status, executor authority, settlement requirements, property condition, and contract terms with the selling agent and your advisers. The suburb comparison uses active asking prices, not sold evidence.
      </p>
    </section>
  );
}

function DualIncomeSection({ listing }: { listing: CatalogueListing }) {
  const isQld = listing.state === "QLD";
  const land = listing.landAreaSqm ? Number(listing.landAreaSqm) : null;
  const mls = listing.minLotSizeSqm ? Number(listing.minLotSizeSqm) : null;
  const zone = listing.zoneCode ?? "";
  const zonePermits = isQld
    ? /(residential|township|mixed use|centre)/i.test(zone)
    : SECONDARY_DWELLING_ZONES.includes(zone);
  const hasSpaceForGrannyFlat = land !== null && land >= 450;
  const price = listing.priceNumeric ? Number(listing.priceNumeric) : null;
  const incomeScenario = buildDualIncomeScenario(price);

  return (
    <section className="rounded-2xl border border-blue-200 bg-card p-5 sm:p-6 dark:border-blue-900">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Investment analysis</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Home className="h-5 w-5 text-blue-600" /> Dual income / granny flat potential
        </h2>
      </div>
      <div className="space-y-2">
        <RiskRow
          icon={<Ruler className="h-4 w-4" />}
          label="Land-size screening benchmark"
          level={hasSpaceForGrannyFlat ? "clear" : land !== null ? "warning" : "unknown"}
          detail={land !== null
            ? `${formatSqm(land)} — ${hasSpaceForGrannyFlat ? "meets a 450 m² early-screening benchmark" : "below a 450 m² early-screening benchmark"}. This is not a council minimum.`
            : "Land area not recorded — verify with agent"}
        />
        <RiskRow
          icon={<Building2 className="h-4 w-4" />}
          label="Zone screening for secondary dwelling"
          level={zone ? (isQld ? "unknown" : zonePermits ? "clear" : "warning") : "unknown"}
          detail={zone
            ? isQld
              ? `${zone} — ${zonePermits ? "residential candidate family" : "not a common residential candidate family"}; verify the council scheme's dwelling-house, secondary-dwelling or dual-occupancy provisions, overlays and servicing rules`
              : `${zone} — ${zonePermits ? "commonly supports secondary dwellings, subject to the LEP, SEPP, lot, access, setback, and servicing rules" : "not in the app's common residential-zone screening list; inspect the LEP and council controls"}`
            : "Zone not recorded — verify with council"}
        />
        <RiskRow
          icon={<Layers className="h-4 w-4" />}
          label="Mapped minimum lot size context"
          level={mls ? "clear" : "unknown"}
          detail={mls
            ? `${formatSqm(mls)} from ${listing.minLotSizeLabel ?? (isQld ? "the council planning scheme" : "the LEP minimum-lot-size map")}. This mapped control is not automatically the minimum for a granny flat or dual occupancy.`
            : "No mapped minimum-lot-size value is stored for this listing."}
        />
      </div>
      <div className="mt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Indicative two-dwelling income</p>
        {incomeScenario ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <PlanningMetricCard label="Main dwelling rent" value={`${formatAud(incomeScenario.estimatedMainDwellingRentWeekly)} / wk`} detail="4.0% gross-yield scenario." />
            <PlanningMetricCard label="Secondary dwelling rent" value={`${formatAud(incomeScenario.estimatedSecondaryDwellingRentWeekly)} / wk`} detail="Modelled at 60% of the main-dwelling rent." />
            <PlanningMetricCard label="Combined rent" value={`${formatAud(incomeScenario.estimatedCombinedRentWeekly)} / wk`} tone="clear" />
            <PlanningMetricCard label="Combined gross yield" value={`${incomeScenario.estimatedCombinedGrossYieldPct.toFixed(1)}%`} tone="clear" />
          </div>
        ) : (
          <PlanningMetricCard label="Rental income potential" value="Cannot calculate" detail="A numeric asking price is not stored for this listing." tone="unknown" />
        )}
      </div>
      <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
        The database does not contain council-specific approval rules or a rental appraisal. Confirm secondary-dwelling and dual-occupancy permissibility, floor area, setbacks, parking, access, services, and approval pathway before relying on this screen.
      </p>
    </section>
  );
}

function DistressedSection({ listing }: { listing: CatalogueListing }) {
  const dom = daysOnMarket(listing.listedAt, listing.firstSeenAt);
  const campaign = describeCampaignUrgency(dom);
  return (
    <section className="rounded-2xl border border-rose-200 bg-card p-5 sm:p-6 dark:border-rose-900">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-300">Investment analysis</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Key className="h-5 w-5 text-rose-600" /> Distressed / mortgagee opportunity screen
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <PlanningMetricCard
          label="Stored sale indicator"
          value="Distressed category tag"
          detail="The catalogue scan classified this listing from its stored listing content. Confirm the precise sale status with the agent."
          tone="flagged"
        />
        <PlanningMetricCard
          label="Urgency / campaign age"
          value={campaign.label}
          detail={dom === null ? campaign.detail : `${dom} days on market. ${campaign.detail}`}
          tone={campaign.tone === "urgent" ? "flagged" : dom === null ? "unknown" : "default"}
        />
        <PlanningMetricCard label="Asking price" value={listing.priceDisplay || "Not disclosed"} tone={listing.priceNumeric ? "default" : "unknown"} />
        <PlanningMetricCard
          label="Price-reduction history"
          value="Not captured"
          detail="The current database stores the latest asking price but not historical price changes."
          tone="unknown"
        />
      </div>
      <div className="mt-5 space-y-3">
        <SuburbMedianCard listing={listing} />
        {listing.suburb && (
          <div className="rounded-xl border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-rose-600" /> Active comparables in {listing.suburb}
            </h3>
            <ComparableListings suburb={listing.suburb} excludeId={listing.id} postcode={listing.postcode} />
          </div>
        )}
      </div>
      <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-relaxed text-rose-800 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
        Confirm whether this is mortgagee-in-possession, receiver, urgent, or another sale type. Review as-is provisions, inspection access, outstanding charges, settlement conditions, and vendor warranties with your conveyancer.
      </p>
    </section>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PropertyDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);

  const { data: listing, isLoading, error } = trpc.catalogue.getById.useQuery(
    { id },
    { enabled: id > 0, staleTime: 300_000, refetchOnWindowFocus: false },
  );

  const { data: watchlist } = trpc.property.listSaved.useQuery(undefined, { staleTime: 60_000 });
  const saveMutation = trpc.property.save.useMutation();
  const utils = trpc.useUtils();
  const [saving, setSaving] = useState(false);

  const [copied, setCopied] = useState(false);

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handlePrint() {
    window.print();
  }

  const isWatchlisted = useMemo(
    () => watchlist?.some((w) => w.listingId === listing?.listingId) ?? false,
    [watchlist, listing],
  );

  async function handleWatchlist() {
    if (!listing || isWatchlisted) return;
    setSaving(true);
    try {
      await saveMutation.mutateAsync({
        listingId: listing.listingId,
        address: listing.address ?? listing.suburb ?? "Unknown",
        suburb: listing.suburb ?? undefined,
        postcode: listing.postcode ?? undefined,
        latitude: listing.latitude ? Number(listing.latitude) : undefined,
        longitude: listing.longitude ? Number(listing.longitude) : undefined,
        priceDisplay: listing.priceDisplay ?? undefined,
        landAreaSqm: listing.landAreaSqm ? Number(listing.landAreaSqm) : undefined,
        minLotSizeSqm: listing.minLotSizeSqm ? Number(listing.minLotSizeSqm) : undefined,
        minLotSizeLabel: listing.minLotSizeLabel ?? undefined,
        lgaName: listing.lgaName ?? undefined,
        zoneCode: listing.zoneCode ?? undefined,
        potentialLots: listing.potentialLots ?? undefined,
        verdict: listing.verdict,
        listingUrl: listing.listingUrl ?? undefined,
        imageUrl: listing.imageUrl ?? undefined,
      });
      await utils.property.listSaved.invalidate();
      toast.success("Added to watchlist");
    } catch {
      toast.error("Failed to save — please try again");
    } finally {
      setSaving(false);
    }
  }

  if (!id || isNaN(id)) {
    return (
      <AppShell>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Invalid property ID.</p>
          <Link href="/catalogue"><Button className="mt-4">Back to catalogue</Button></Link>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="container py-8 max-w-5xl">
          <div className="animate-pulse space-y-4">
            <div className="h-5 w-36 bg-muted rounded" />
            <div className="h-72 w-full bg-muted rounded-xl" />
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
            </div>
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !listing) {
    return (
      <AppShell>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Property not found.</p>
          <Link href="/catalogue"><Button className="mt-4">Back to catalogue</Button></Link>
        </div>
      </AppShell>
    );
  }

  const land = listing.landAreaSqm ? Number(listing.landAreaSqm) : null;
  const dom = daysOnMarket(listing.listedAt, listing.firstSeenAt);
  const tags = parseTags(listing.investmentTags);
  const priceNum = listing.priceNumeric ? Number(listing.priceNumeric) : null;
  const ppl = priceNum && listing.potentialLots && listing.potentialLots > 1
    ? priceNum / listing.potentialLots : null;

  const verdictMeta = {
    subdividable:     { label: "Subdividable",      className: "bg-emerald-500/15 text-emerald-700 border-emerald-300/40 dark:text-emerald-300" },
    marginal:         { label: "Marginal",           className: "bg-amber-500/15 text-amber-700 border-amber-300/40 dark:text-amber-300" },
    not_subdividable: { label: "Not subdividable",   className: "bg-red-500/15 text-red-700 border-red-300/40 dark:text-red-300" },
    unknown:          { label: "Unverified",         className: "bg-muted text-muted-foreground border-muted-foreground/20" },
  };
  const vm = verdictMeta[listing.verdict ?? "unknown"];

  // Determine which category sections to show
  const isSubdivision = listing.verdict === "subdividable" || listing.verdict === "marginal";
  const isDevSite = tags.includes("dev_site");
  const isPosGeared = tags.includes("pos_geared");
  const isDeceasedEstate = tags.includes("deceased_estate");
  const isDualIncome = tags.includes("dual_income");
  const isDistressed = tags.includes("distressed");
  // Always show subdivision section if it has a meaningful score or subdivision verdict
  const showSubdivision = isSubdivision || listing.score > 20;
  const planningIsPrimary = isDevSite || showSubdivision;

  return (
    <AppShell>
      <div className="container py-6 max-w-5xl">

        {/* ── Back nav ── */}
        <Link href="/catalogue">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5">
            <ArrowLeft className="h-4 w-4" /> Back to catalogue
          </button>
        </Link>

        {/* ── Hero card ── */}
        <div className="rounded-2xl overflow-hidden border bg-card shadow-sm mb-6">
          {listing.imageUrl ? (
            <div className="relative">
              <img src={listing.imageUrl} alt={listing.address ?? "Property"}
                className="w-full h-64 md:h-80 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                <div>
                  <h1 className="text-xl md:text-2xl font-semibold text-white leading-snug drop-shadow">
                    {listing.address ?? listing.headline ?? `${listing.suburb ?? listing.state ?? "NSW"} property`}
                  </h1>
                  {listing.suburb && (
                    <p className="text-sm text-white/80 flex items-center gap-1 mt-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {listing.suburb}{listing.postcode ? ` ${listing.postcode}` : ""}{listing.state ? `, ${listing.state}` : ""}
                    </p>
                  )}
                </div>
                <Badge className={`border text-sm px-3 py-1 shrink-0 ${vm.className}`}>
                  {vm.label}{listing.verdict === "subdividable" && listing.potentialLots ? ` · ${listing.potentialLots} lots` : ""}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl md:text-2xl font-semibold text-foreground leading-snug">
                    {listing.address ?? listing.headline ?? `${listing.suburb ?? listing.state ?? "NSW"} property`}
                  </h1>
                  {listing.suburb && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {listing.suburb}{listing.postcode ? ` ${listing.postcode}` : ""}{listing.state ? `, ${listing.state}` : ""}
                    </p>
                  )}
                </div>
                <Badge className={`border text-sm px-3 py-1 shrink-0 ${vm.className}`}>
                  {vm.label}{listing.verdict === "subdividable" && listing.potentialLots ? ` · ${listing.potentialLots} lots` : ""}
                </Badge>
              </div>
            </div>
          )}

          {/* Key stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 border-t">
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">Asking price</p>
              <p className="text-lg font-bold text-foreground">{listing.priceDisplay || "POA"}</p>
              {ppl && <p className="text-xs text-emerald-700 font-medium mt-0.5">{formatAud(ppl)} / lot</p>}
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">Land area</p>
              <p className="text-lg font-bold text-foreground">{land ? formatSqm(land) : "—"}</p>
              {listing.propertyType && <p className="text-xs text-muted-foreground mt-0.5 capitalize">{listing.propertyType}</p>}
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">Bedrooms / Baths</p>
              <p className="text-lg font-bold text-foreground flex items-center gap-2">
                {listing.bedrooms != null
                  ? <span className="flex items-center gap-1"><BedDouble className="h-4 w-4 text-muted-foreground" />{listing.bedrooms}</span>
                  : "—"}
                {listing.bathrooms != null
                  ? <span className="flex items-center gap-1"><Bath className="h-4 w-4 text-muted-foreground" />{listing.bathrooms}</span>
                  : null}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">Days on market</p>
              <p className="text-lg font-bold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {dom !== null ? (dom === 0 ? "New today" : `${dom}d`) : "—"}
              </p>
              {listing.listedAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Listed {new Date(listing.listedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-wrap gap-3 mb-6">
          {listing.listingUrl && (
            <Button asChild variant="outline" className="gap-2">
              <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer">
                View on realestate.com.au <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          <Button onClick={handleWatchlist} disabled={isWatchlisted || saving}
            variant={isWatchlisted ? "secondary" : "default"} className="gap-2">
            {isWatchlisted
              ? <><BookmarkCheck className="h-4 w-4" /> Saved to watchlist</>
              : <><BookmarkPlus className="h-4 w-4" /> {saving ? "Saving…" : "Add to watchlist"}</>}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleCopyLink}>
            {copied ? <ClipboardCheck className="h-4 w-4 text-emerald-600" /> : <Clipboard className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy link"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Export PDF
          </Button>
        </div>

        {/* ── Investment category tags ── */}
        {tags.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Investment categories</p>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Link key={tag} href={`/niche/${tag}`}>
                  <Badge className={`border text-sm px-3 py-1.5 cursor-pointer hover:opacity-80 transition-opacity ${INVESTMENT_TAG_COLORS[tag as InvestmentTag]}`}>
                    {INVESTMENT_TAG_LABELS[tag as InvestmentTag]}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Risk flags alert banner ── */}
        {(listing.bushfireCategory || listing.floodRisk || listing.heritageFlag || listing.biodiversityFlag || listing.acidSulfateClass) && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 px-5 py-4 mb-6 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1.5">Risk flags detected</p>
              <div className="flex flex-wrap gap-1.5">
                {listing.bushfireCategory && (
                  <Badge variant="outline" className="text-xs border-orange-400 text-orange-700 dark:text-orange-400 gap-1">
                    <Flame className="h-3 w-3" /> Bushfire
                  </Badge>
                )}
                {listing.floodRisk && (
                  <Badge variant="outline" className="text-xs border-blue-400 text-blue-700 dark:text-blue-400 gap-1">
                    <Droplets className="h-3 w-3" /> Flood zone
                  </Badge>
                )}
                {listing.heritageFlag && (
                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 dark:text-amber-400 gap-1">
                    <Landmark className="h-3 w-3" /> Heritage
                  </Badge>
                )}
                {listing.biodiversityFlag && (
                  <Badge variant="outline" className="text-xs border-green-500 text-green-700 dark:text-green-400 gap-1">
                    <Leaf className="h-3 w-3" /> Biodiversity
                  </Badge>
                )}
                {listing.acidSulfateClass && (
                  <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 dark:text-yellow-400 gap-1">
                    <AlertTriangle className="h-3 w-3" /> ASS {listing.acidSulfateClass}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Two-column layout ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

          {/* Left: category-adaptive investment analysis + universal planning data */}
          <div className="space-y-6">

            {planningIsPrimary && <PlanningPortalSection listing={listing} prominent />}

            {isDevSite && <DevSiteSection listing={listing} />}
            {isPosGeared && <PosGearedSection listing={listing} />}
            {isDeceasedEstate && <DeceasedEstateSection listing={listing} />}
            {isDualIncome && <DualIncomeSection listing={listing} />}
            {isDistressed && <DistressedSection listing={listing} />}
            {showSubdivision && <SubdivisionSection listing={listing} />}

            {!planningIsPrimary && <PlanningPortalSection listing={listing} />}

          </div>

          {/* Right sidebar */}
          <div className="space-y-5">

            {/* Listing details */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" /> Listing details
              </h2>
              <div className="space-y-2 text-sm">
                {listing.propertyType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Property type</span>
                    <span className="font-medium capitalize">{listing.propertyType}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={listing.status === "active" ? "default" : "secondary"} className="text-xs">
                    {listing.status === "active" ? "Active" : listing.status === "sold" ? "Sold" : "Removed"}
                  </Badge>
                </div>
                {listing.category && listing.category !== "unknown" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{listing.category === "cash_flow" ? "Cash flow" : "Land only"}</span>
                  </div>
                )}
                {dom !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days on market</span>
                    <span className="font-medium">{dom === 0 ? "New today" : `${dom} days`}</span>
                  </div>
                )}
                {listing.listedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Listed</span>
                    <span className="font-medium">{new Date(listing.listedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">First seen</span>
                  <span className="font-medium">{new Date(listing.firstSeenAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {listing.regionId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Region</span>
                    <span className="font-medium capitalize text-right">{listing.regionId.replace(/_/g, " ")}</span>
                  </div>
                )}
              </div>
              <Separator className="my-4" />
              <div className="flex flex-col gap-2">
                {listing.listingUrl && (
                  <Button asChild size="sm" variant="outline" className="w-full gap-2">
                    <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer">
                      View on REA <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <Button size="sm" onClick={handleWatchlist} disabled={isWatchlisted || saving}
                  variant={isWatchlisted ? "secondary" : "default"} className="w-full gap-2">
                  {isWatchlisted
                    ? <><BookmarkCheck className="h-3.5 w-3.5" /> Saved</>
                    : <><BookmarkPlus className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Add to watchlist"}</>}
                </Button>
              </div>
            </div>

            {/* Location links */}
            {listing.latitude && listing.longitude && (
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Location
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  {Number(listing.latitude).toFixed(6)}, {Number(listing.longitude).toFixed(6)}
                </p>
                <div className="flex flex-col gap-2">
                  <Button asChild size="sm" variant="outline" className="w-full gap-2 text-xs">
                    <a href={`https://maps.google.com/?q=${listing.latitude},${listing.longitude}`} target="_blank" rel="noopener noreferrer">
                      <MapPin className="h-3.5 w-3.5" /> Google Maps
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="w-full gap-2 text-xs">
                    <a
                      href={listing.state === "QLD"
                        ? "https://qldglobe.information.qld.gov.au/"
                        : `https://maps.six.nsw.gov.au/?lon=${listing.longitude}&lat=${listing.latitude}&z=17`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Layers className="h-3.5 w-3.5" /> {listing.state === "QLD" ? "QLD Globe" : "NSW Spatial Viewer"}
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {/* Data freshness */}
            <div className="rounded-xl border bg-muted/30 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Data freshness</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Last confirmed active: {new Date(listing.lastSeenAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Planning data captured at time of analysis. Verify with council before purchase.
              </p>
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
