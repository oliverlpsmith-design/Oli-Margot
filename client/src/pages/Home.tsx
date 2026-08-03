import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Database,
  FileSearch,
  Filter,
  Landmark,
  Layers,
  Ruler,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import {
  ALL_INVESTMENT_TAGS,
  INVESTMENT_TAG_COLORS,
  INVESTMENT_TAG_DESCRIPTIONS,
  INVESTMENT_TAG_LABELS,
  type InvestmentTag,
} from "@/lib/investmentTags";
import { HOMEPAGE_DISCOVERY_STEPS } from "@/lib/discoveryMethodology";
import { SUBDIVISION_BROWSE_HREF } from "@shared/subdivisionDefaults";

const FEATURES = [
  {
    icon: Database,
    title: "Pre-built catalogues — not a search tool",
    body: "Every investment angle has its own pre-analysed catalogue. Subdivision, dual income, deceased estates, development sites, distressed sales — the deals are already found, scored, and waiting. You just filter and shortlist.",
  },
  {
    icon: CalendarClock,
    title: "Nightly automated updates",
    body: "Every night the system sweeps the market: new listings are caught, analysed, and added within hours of hitting the market; sold properties are removed automatically. The catalogue never goes stale.",
  },
  {
    icon: Clock,
    title: "Days-on-market tracking",
    body: "Every property shows exactly how long it's been listed. Sort by newest to jump on fresh high-scorers before other investors have even seen them — the best deals move in days.",
  },
  {
    icon: TrendingUp,
    title: "Automated subdivision scoring",
    body: "Every listing is scored 0–100 for subdivision potential — land area vs. minimum lot size, zoning, and estimated lot yield — so the strongest opportunities always rise to the top.",
  },
  {
    icon: Landmark,
    title: "Live minimum lot size checks",
    body: "Minimum lot sizes and zoning are queried from official planning portals at each property's exact coordinates — the same layers behind the official Spatial Viewer, never a guess.",
  },
  {
    icon: ShieldAlert,
    title: "Built-in risk analysis",
    body: "Bushfire prone land, biodiversity values, flood planning, and heritage constraints are checked against government risk layers — deal-killers surfaced before you spend a cent on due diligence.",
  },
  {
    icon: FileSearch,
    title: "DA comparables on demand",
    body: "See recent subdivision development applications near any property — lots before and after, approval status, and distance — proof that council actually approves splits in that street.",
  },
  {
    icon: Filter,
    title: "Practicality filters",
    body: "Knock out false positives fast: minimum land size, lot width/frontage, dwelling coverage ratio, and a one-tap toggle to exclude new builds and estate stock that will never split.",
  },
];

const CAPABILITIES = [
  "Cash-flow vs land-only categorisation",
  "Sort by score, freshness, land size, or price per lot",
  "NSW and QLD coverage — metro, regional, rural and remote search units",
  "Region, score, and days-on-market filters",
  "Suburb, postcode, and LGA text search",
  "Watchlist to track your shortlist",
  "CSV export for your own models",
  "Direct links to verify every data point at the source",
];

const STEPS = [
  {
    title: "Browse",
    body: "Open the catalogue of pre-analysed NSW and QLD listings. Unit stock and hopeless small blocks are filtered out at the source.",
  },
  {
    title: "Filter",
    body: "Every listing is already scored against official planning layers. Narrow by region, score, land size, price per lot, and days on market.",
  },
  {
    title: "Shortlist",
    body: "Open the full report card, check risks and DA comparables, save winners to your watchlist, and move before the market catches up.",
  },
];

const TRUST_POINTS = [
  "NSW Planning Portal — EPI planning layers (zoning, min lot size, heritage, FSR, height)",
  "NSW RFS Bushfire Prone Land register",
  "NSW Biodiversity Values Map (BOSET)",
  "Flood planning & hazard layers (EPI-based)",
  "NSW Online DA data (2019–present)",
  "QLD Globe, State Planning Policy mapping, and validated council spatial services",
  "Live for-sale listings across NSW and Queensland",
];

export default function Home() {
  const { user } = useAuth();
  const { data: stats } = trpc.property.stats.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: latestFinds } = trpc.catalogue.latestFinds.useQuery(
    { limit: 10 },
    { staleTime: 120_000, refetchOnWindowFocus: false },
  );
  const { data: tagCounts } = trpc.catalogue.tagCounts.useQuery(undefined, {
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  // Round down to a clean marketing-safe figure; hide until real data arrives.
  const scanned = stats && stats.listingsScanned >= 1000
    ? `${Math.floor(stats.listingsScanned / 1000).toLocaleString()},000+ listings scanned to date`
    : stats && stats.listingsScanned > 0
      ? `${stats.listingsScanned.toLocaleString()} listings scanned to date`
      : null;

  return (
    <AppShell>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[oklch(0.19_0.03_165)] text-white">
        {/* Subtle grid texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        {/* Radial glow */}
        <div
          aria-hidden
          className="absolute -top-40 left-1/2 -translate-x-1/2 h-[480px] w-[900px] rounded-full opacity-30 blur-3xl"
          style={{ background: "oklch(0.55 0.12 160)" }}
        />

        <div className="container relative py-20 md:py-24">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            {/* Left: headline + CTA */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                  Free during early access
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                  Australia-wide investment intelligence
                </span>
              </div>

              <h1
                className="text-4xl md:text-[3.4rem] font-medium leading-[1.08] tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Find investment opportunities{" "}
                <span className="text-emerald-300">realestate.com.au doesn't show you</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
                The major portals don't have filters for deceased estates, subdividable land, dual
                income properties, or distressed sales. We do. Every listing is pre-analysed
                against official planning data and classified by investment angle — so you see the
                deals other investors miss. Currently covering NSW and Queensland.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {user ? (
                  <Link href="/catalogue">
                    <Button
                      size="lg"
                      className="h-12 px-7 text-base bg-emerald-400 text-[oklch(0.19_0.03_165)] hover:bg-emerald-300 shadow-lg shadow-emerald-400/20"
                    >
                      Browse the catalogue
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="lg"
                    className="h-12 px-7 text-base bg-emerald-400 text-[oklch(0.19_0.03_165)] hover:bg-emerald-300 shadow-lg shadow-emerald-400/20"
                    onClick={() => startLogin()}
                  >
                    Sign up free
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
                <Link href="/watchlist">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 text-base border-white/25 text-white hover:bg-white/10 hover:text-white"
                  >
                    View watchlist
                  </Button>
                </Link>
              </div>

              <p className="mt-4 text-sm text-white/50">
                {user ? "Full access unlocked · 5 investment niches · updated nightly" : "Free sign-up · 5 investment niches · updated nightly"}
              </p>
            </div>

            {/* Right: product proof card */}
            <div className="relative hidden lg:block">
              <div className="rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium uppercase tracking-wider text-white/50">
                    Sample analysis
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 border border-emerald-300/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Subdividable
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.05] border border-white/10 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-white/70">
                      <Ruler className="h-4 w-4 text-emerald-300" /> Land area
                    </span>
                    <span className="text-sm font-semibold">1,290 m²</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.05] border border-white/10 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-white/70">
                      <Landmark className="h-4 w-4 text-emerald-300" /> Minimum lot size (LEP)
                    </span>
                    <span className="text-sm font-semibold">600 m²</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.05] border border-white/10 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-white/70">
                      <Layers className="h-4 w-4 text-emerald-300" /> Zoning
                    </span>
                    <span className="text-sm font-semibold">R2 Low Density Residential</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-emerald-400/10 border border-emerald-300/25 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-emerald-200">
                      <TrendingUp className="h-4 w-4" /> Potential lot yield
                    </span>
                    <span className="text-sm font-bold text-emerald-300">2 lots</span>
                  </div>
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-white/40">
                  Live query of official planning portal lot size &amp; zoning layers at the parcel's
                  coordinates. Indicative — verify with council before purchase.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Credibility strip */}
        <div className="relative border-t border-white/10 bg-white/[0.03]">
          <div className="container py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-white/60">
              <BadgeCheck className="h-4 w-4 text-emerald-300" />
              Powered by official government data
            </span>
            <span className="hidden sm:block h-3 w-px bg-white/15" />
            <span className="text-xs text-white/50">5 investment niches</span>
            <span className="hidden sm:block h-3 w-px bg-white/15" />
            <span className="text-xs text-white/50">4 risk layers per property</span>
            {scanned && (
              <>
                <span className="hidden sm:block h-3 w-px bg-white/15" />
                <span className="text-xs text-white/50">{scanned}</span>
              </>
            )}
          </div>
        </div>

        {/* Live latest-finds ticker (hidden until catalogue has confirmed finds) */}
        {latestFinds && latestFinds.length > 0 && (
          <div className="relative border-t border-white/10 bg-emerald-400/[0.06]">
            <div className="container py-2.5 flex items-center gap-3 overflow-hidden">
              <span className="relative z-10 shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.23_0.04_165)] border border-emerald-300/30 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                </span>
                Latest finds
              </span>
              <div className="relative flex-1 overflow-hidden ticker-mask">
                <div className="flex w-max gap-8 animate-ticker hover:[animation-play-state:paused]">
                  {[...latestFinds, ...latestFinds].map((f, i) => {
                    const days = Math.max(
                      0,
                      Math.floor(
                        (Date.now() - new Date(f.listedAt ?? f.firstSeenAt).getTime()) / 86_400_000,
                      ),
                    );
                    return (
                      <Link
                        key={`${f.listingId}-${i}`}
                        href="/catalogue"
                        className="flex shrink-0 items-center gap-2 text-xs text-white/70 hover:text-white transition-colors"
                      >
                        <span
                          className={
                            f.verdict === "subdividable"
                              ? "font-semibold text-emerald-300"
                              : "font-semibold text-amber-300"
                          }
                        >
                          {f.verdict === "subdividable"
                            ? `Subdividable${f.potentialLots ? ` · ${f.potentialLots} lots` : ""}`
                            : "Marginal"}
                        </span>
                        <span>
                          {f.suburb ?? "NSW"}
                          {f.postcode ? ` ${f.postcode}` : ""}
                        </span>
                        {f.landAreaSqm && (
                          <span className="text-white/45">
                            {Number(f.landAreaSqm) >= 10000
                              ? `${(Number(f.landAreaSqm) / 10000).toLocaleString(undefined, { maximumFractionDigits: 1 })} ha`
                              : `${Math.round(Number(f.landAreaSqm)).toLocaleString()} m²`}
                          </span>
                        )}
                        <span className="text-white/45">Score {f.score}</span>
                        <span className="text-emerald-200/60">
                          {days === 0 ? "new today" : `${days}d ago`}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="container py-16 md:py-20">
        <div className="max-w-2xl mb-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-2">
            Why investors use it
          </p>
          <h2
            className="text-3xl md:text-4xl font-medium tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            The research the portals can't do
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            realestate.com.au and Domain let you filter by bedrooms and price. They can't tell you
            which properties are subdividable, which are deceased estates, or which have bushfire
            constraints that will kill your DA. Investor Scout can — because we query the government
            data directly, for every listing, every night. Currently covering NSW and Queensland,
            with unavailable QLD council controls left visibly unverified for manual review.
          </p>
        </div>

        {/* ── Investment niche cards ── */}
        <div className="mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Browse by investment strategy
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* Subdivision — always live */}
            <Link href={SUBDIVISION_BROWSE_HREF}>
              <div className="group rounded-xl border bg-card p-5 hover:shadow-md hover:border-primary/40 transition-all duration-200 cursor-pointer h-full">
                <div className="flex items-start justify-between mb-3">
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700 border-emerald-300/40 dark:text-emerald-300">
                    Live
                  </span>
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1">Subdivision</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pre-analysed against official planning portal lot sizes and zoning. Scored 0–100.
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
                  Browse <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </Link>

            {/* Live niche tags */}
            {ALL_INVESTMENT_TAGS.map((tag: InvestmentTag) => {
              const count = tagCounts?.[tag] ?? 0;
              const chipClass = INVESTMENT_TAG_COLORS[tag];
              const label = INVESTMENT_TAG_LABELS[tag];
              const desc = INVESTMENT_TAG_DESCRIPTIONS[tag];
              return (
                <Link key={tag} href={`/niche/${tag}`}>
                  <div className="group rounded-xl border bg-card p-5 hover:shadow-md hover:border-primary/40 transition-all duration-200 cursor-pointer h-full">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${chipClass}`}>
                        {count > 0 ? `${count.toLocaleString()} listings` : "Live"}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">{label}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{desc}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
                      Browse <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mb-12 rounded-2xl border border-primary/20 bg-primary/[0.035] p-6 md:p-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              How Investor Scout finds opportunities
            </p>
            <h2 className="mt-2 text-2xl font-medium tracking-tight text-foreground">
              Classification first, evidence beside it
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Investor Scout combines listing-language signals, simple numeric heuristics and stored
              planning data to build focused research catalogues. Classification is an initial screen,
              not investment or planning advice; every category page publishes its current rules and
              limitations.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {HOMEPAGE_DISCOVERY_STEPS.map((step, index) => (
              <div key={step.title} className="rounded-xl border bg-card p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
              </div>
            ))}
          </div>
          <Link href={SUBDIVISION_BROWSE_HREF} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View a category's exact methodology <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* ── Coming soon niches ── */}
        <div className="mb-12 rounded-xl border bg-secondary/40 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Coming soon — more niches &amp; states</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "Off-market leads",
              "Below-median value",
              "Corner blocks",
              "Flood-free rural acreage",
              "Rezoning pipeline",
              "Infrastructure corridor plays",
              "Institutional buying signals",
              "QLD expansion",
              "VIC expansion",
              "WA expansion",
            ].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                <Clock className="h-3 w-3" />
                {item}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground/70">
            Investor Scout is expanding beyond NSW and beyond real estate — tracking where institutional
            capital moves, infrastructure pipeline signals, and rezoning applications before they
            hit mainstream media. Think of it as Bloomberg for property investors: the signals are
            public, but nobody has assembled them in one place until now.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-xl border bg-card p-6 transition-all duration-200 hover:shadow-md hover:border-primary/30"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-105">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>

        {/* Capability chips */}
        <div className="mt-8 rounded-xl border bg-secondary/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            And everything else you'd expect
          </p>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map(cap => (
              <span
                key={cap}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                {cap}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works + data sources ──────────────────────── */}
      <section className="border-y bg-secondary/60">
        <div className="container py-16 grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
          <div>
            <h2
              className="text-2xl md:text-3xl font-medium tracking-tight text-foreground mb-8"
              style={{ fontFamily: "var(--font-display)" }}
            >
                From catalogue to shortlist in three steps
            </h2>
            <ol className="space-y-6">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border bg-card p-6 md:p-8 self-start">
            <div className="flex items-center gap-2 mb-5">
              <BadgeCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Grounded in official data</h3>
            </div>
            <ul className="space-y-3">
              {TRUST_POINTS.map(point => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-muted-foreground/80 leading-relaxed border-t pt-4">
              Every analysis links back to the official Spatial Viewer and source layers so you can
              verify any result independently before you commit a dollar.
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="container py-16 md:py-20">
        <div className="rounded-2xl bg-[oklch(0.19_0.03_165)] text-white px-8 py-12 md:px-14 md:py-14 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
            style={{ background: "oklch(0.55 0.12 160)" }}
          />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl">
              <h2
                className="text-2xl md:text-3xl font-medium tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Your next deal is already in the data. Find it first.
              </h2>
              <p className="mt-3 text-white/70 text-sm md:text-base">
                Subdivision, dual income, deceased estates, development sites — every niche
                pre-analysed and waiting. Free during early access. The investors who move first win.
              </p>
            </div>
            {user ? (
              <Link href="/catalogue">
                <Button
                  size="lg"
                  className="h-12 px-7 text-base bg-emerald-400 text-[oklch(0.19_0.03_165)] hover:bg-emerald-300 shrink-0 shadow-lg shadow-emerald-400/20"
                >
                  Browse the catalogue
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button
                size="lg"
                className="h-12 px-7 text-base bg-emerald-400 text-[oklch(0.19_0.03_165)] hover:bg-emerald-300 shrink-0 shadow-lg shadow-emerald-400/20"
                onClick={() => startLogin()}
              >
                Sign up free
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
