import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gem,
  GitFork,
  HelpCircle,
  Landmark,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const PERSONA_VISUALS = {
  subdivider: {
    icon: GitFork,
    accent: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    border: "border-emerald-200",
    wash: "from-emerald-50 to-white",
  },
  cash_flow_hunter: {
    icon: WalletCards,
    accent: "text-sky-700",
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    border: "border-sky-200",
    wash: "from-sky-50 to-white",
  },
  value_finder: {
    icon: Gem,
    accent: "text-amber-700",
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    border: "border-amber-200",
    wash: "from-amber-50 to-white",
  },
} as const;

function formatCurrency(value: number | string | null | undefined, compact = false) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not stated";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(amount);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not yet run";
  return new Date(value).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatNumber(value: number | string | null | undefined, suffix = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not mapped";
  return `${new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(number)}${suffix}`;
}

function confidenceLabel(value: number) {
  if (value >= 70) return "Higher evidence";
  if (value >= 45) return "Moderate evidence";
  return "Limited evidence";
}

function riskSummary(listing: {
  bushfireStatus: "clear" | "flagged" | "unknown";
  floodStatus: "clear" | "flagged" | "unknown";
  heritageFlag: string | null;
  biodiversityFlag: string | null;
}) {
  const flags = [
    listing.bushfireStatus === "flagged" ? "Bushfire" : null,
    listing.floodStatus === "flagged" ? "Flood" : null,
    listing.heritageFlag ? "Heritage" : null,
    listing.biodiversityFlag ? "Biodiversity" : null,
  ].filter(Boolean);
  return flags.length ? flags.join(" · ") : "No stored mapped flags";
}

function PlanningSnapshot({
  listing,
}: {
  listing: {
    zoneCode: string | null;
    minLotSizeSqm: string | null;
    minLotSizeLabel: string | null;
    fsrValue: string | null;
    maxBuildingHeightM: string | null;
    bushfireStatus: "clear" | "flagged" | "unknown";
    floodStatus: "clear" | "flagged" | "unknown";
    heritageFlag: string | null;
    biodiversityFlag: string | null;
  };
}) {
  const cells = [
    { label: "Zoning", value: listing.zoneCode ?? "Not mapped" },
    {
      label: "Minimum lot",
      value: listing.minLotSizeLabel ?? formatNumber(listing.minLotSizeSqm, " m²"),
    },
    { label: "Floor space ratio", value: listing.fsrValue ? `${listing.fsrValue}:1` : "Not mapped" },
    { label: "Max. height", value: formatNumber(listing.maxBuildingHeightM, " m") },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
          <MapPinned className="h-3.5 w-3.5" /> NSW planning snapshot
        </span>
        <span className="text-[11px] text-slate-500">Verify before relying</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map(cell => (
          <div key={cell.label} className="rounded-lg bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-200/70">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{cell.label}</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{cell.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span><strong>Mapped risk flags:</strong> {riskSummary(listing)}</span>
      </div>
    </div>
  );
}

function AnalystLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ["The Subdivider", "Planning, site capacity and mapped constraints"],
        ["The Cash Flow Hunter", "Disclosed finance scenario and demand signals"],
        ["The Value Finder", "Comparable asking prices and motivated-sale evidence"],
      ].map(([name, focus]) => (
        <Card key={name} className="overflow-hidden border-slate-200">
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500" />
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-muted-foreground">{focus}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Activity className="h-3.5 w-3.5 animate-pulse text-primary" /> Loading latest completed shortlist
            </div>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-4/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AgentPicks() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const current = trpc.aiAnalyst.currentPicks.useQuery(undefined, {
    staleTime: 60_000,
  });
  const history = trpc.aiAnalyst.runHistory.useQuery(
    { limit: 6 },
    { enabled: isAdmin, refetchInterval: isAdmin ? 15_000 : false },
  );
  const rerun = trpc.aiAnalyst.runNow.useMutation({
    onSuccess: async result => {
      if (result.started) {
        toast.success("AI analyst run completed");
      } else {
        toast.info("An analyst run is already in progress");
      }
      await Promise.all([
        utils.aiAnalyst.currentPicks.invalidate(),
        utils.aiAnalyst.runHistory.invalidate(),
      ]);
    },
    onError: error => toast.error(`Analyst run failed: ${error.message}`),
  });

  const latestStatus = history.data?.[0];

  return (
    <AppShell>
      <div className="container space-y-8 py-8 sm:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 px-5 py-8 text-white shadow-xl sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.35fr_.65fr] lg:items-end">
            <div>
              <Badge className="mb-4 border-white/15 bg-white/10 text-white hover:bg-white/10">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI-powered catalogue analysis
              </Badge>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
                Three strategies. One evidence-led shortlist.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Independent AI personas screen the existing Investor Scout catalogue, rank their strongest current candidates, and show the evidence, risks and unknowns behind every selection.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400">Last analysis</div>
                <div className="mt-1 text-sm font-medium text-white">{formatDate(current.data?.run?.finishedAt)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400">Current shortlist</div>
                <div className="mt-1 text-2xl font-semibold text-white">
                  {current.data?.personas.reduce((sum, persona) => sum + persona.picks.length, 0) ?? "—"}
                  <span className="ml-1 text-sm font-normal text-slate-400">picks</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Research signals, not investment advice</AlertTitle>
          <AlertDescription>
            Scores are hypothetical, depend on catalogue completeness, and do not predict returns. The Cash Flow Hunter uses a clearly stated scenario because verified rent, vacancy and operating-expense data is not yet available.
          </AlertDescription>
        </Alert>

        {isAdmin && (
          <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-violet-200 bg-white text-violet-800">Admin only</Badge>
                    {latestStatus?.status === "running" && (
                      <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                        <Activity className="mr-1 h-3 w-3" /> Analysis in progress
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="mt-2 text-lg">AI analyst control</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Weekly automation runs Sunday at 17:00 UTC. Manual runs use the same locked, incremental pipeline.
                  </p>
                </div>
                <Button
                  onClick={() => rerun.mutate()}
                  disabled={rerun.isPending || latestStatus?.status === "running"}
                  className="gap-2 active:scale-[0.97]"
                >
                  <RefreshCw className={`h-4 w-4 ${rerun.isPending ? "animate-spin" : ""}`} />
                  {rerun.isPending ? "Analysing catalogue…" : "Run analysis now"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Latest status</div>
                  <div className="mt-1 font-semibold capitalize">{latestStatus?.status ?? "No run recorded"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Scored / reused</div>
                  <div className="mt-1 font-semibold">
                    {latestStatus ? `${latestStatus.scoredCount} / ${latestStatus.reusedCount}` : "—"}
                  </div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Model calls</div>
                  <div className="mt-1 font-semibold">{latestStatus?.llmCallCount ?? "—"}</div>
                </div>
              </div>
              {latestStatus?.error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{latestStatus.error}</p>
              )}
            </CardContent>
          </Card>
        )}

        {current.isLoading && <AnalystLoading />}

        {current.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Agent picks could not be loaded</AlertTitle>
            <AlertDescription>{current.error.message}</AlertDescription>
          </Alert>
        )}

        {!current.isLoading && !current.error && !current.data?.run && (
          <Card className="border-dashed py-10 text-center">
            <CardContent>
              <Bot className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">The agents are preparing their first shortlist</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Once the first completed analysis is available, this page will show three ranked candidates per persona. Failed or incomplete runs are never published here.
              </p>
            </CardContent>
          </Card>
        )}

        {current.data?.run && current.data.personas.map(persona => {
          const visuals = PERSONA_VISUALS[persona.key];
          const PersonaIcon = visuals.icon;
          return (
            <section key={persona.key} className="scroll-mt-20 space-y-4" id={persona.key}>
              <div className={`rounded-2xl border ${visuals.border} bg-gradient-to-r ${visuals.wash} p-5`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
                      <PersonaIcon className={`h-5 w-5 ${visuals.accent}`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-950">{persona.name}</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{persona.strategy}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" /> Analysed {formatDate(current.data.run?.finishedAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`${visuals.badge} shrink-0 text-sm`}>
                    Hypothetical budget {formatCurrency(persona.hypotheticalBudget, true)}
                  </Badge>
                </div>
              </div>

              {persona.picks.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No active candidate met this persona’s evidence and budget gates in the latest completed run.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-5 xl:grid-cols-3">
                  {persona.picks.map(pick => (
                    <Card key={`${persona.key}-${pick.listing.id}`} className="group overflow-hidden border-slate-200 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                      <div className="relative h-44 overflow-hidden bg-slate-100">
                        {pick.listing.imageUrl ? (
                          <img
                            src={pick.listing.imageUrl}
                            alt={pick.listing.address ? `Property at ${pick.listing.address}` : "Agent-picked NSW property"}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                            <Landmark className="h-10 w-10 text-slate-400" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/65 to-transparent p-3 pb-8">
                          <Badge className="border-white/20 bg-white/95 text-slate-950 hover:bg-white">#{pick.rank} pick</Badge>
                          <div className="rounded-xl bg-slate-950/90 px-3 py-2 text-center text-white shadow-lg backdrop-blur">
                            <div className="text-2xl font-bold leading-none">{pick.qualityScore}</div>
                            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-300">quality</div>
                          </div>
                        </div>
                      </div>

                      <CardContent className="space-y-4 p-5">
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <Badge variant="outline" className={visuals.badge}>{confidenceLabel(pick.evidenceConfidence)}</Badge>
                            <span className="text-xs text-muted-foreground">Evidence {pick.evidenceConfidence}/100</span>
                          </div>
                          <h3 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug text-slate-950">
                            {pick.listing.address ?? `${pick.listing.suburb ?? "NSW"} property`}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span>{pick.listing.suburb} {pick.listing.postcode}</span>
                            {pick.listing.propertyType && <span className="capitalize">{pick.listing.propertyType}</span>}
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-900">
                            {pick.listing.priceDisplay ?? formatCurrency(pick.listing.priceNumeric)}
                          </div>
                        </div>

                        <PlanningSnapshot listing={pick.listing} />

                        <div className="rounded-xl bg-slate-950 px-4 py-3 text-slate-100">
                          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                            <Sparkles className="h-3.5 w-3.5" /> Why this agent selected it
                          </div>
                          <p className="mt-2 text-sm leading-6">{pick.rationale}</p>
                        </div>

                        {pick.scenarioAssumptions && (
                          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-800">
                              <WalletCards className="h-3.5 w-3.5" /> Scenario-based cash flow
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                              <div><span className="text-sky-700">Assumed yield</span><br /><strong>{pick.scenarioAssumptions.assumedGrossYieldPct}%</strong></div>
                              <div><span className="text-sky-700">Estimated rent</span><br /><strong>{formatCurrency(pick.scenarioAssumptions.estimatedWeeklyRent)}/wk</strong></div>
                              <div><span className="text-sky-700">Rate / LVR</span><br /><strong>{pick.scenarioAssumptions.interestRatePct}% / {pick.scenarioAssumptions.loanToValuePct}%</strong></div>
                              <div><span className="text-sky-700">Net scenario</span><br /><strong>{formatCurrency(pick.scenarioAssumptions.weeklyNetCashflow)}/wk</strong></div>
                            </div>
                            <p className="mt-2 text-[11px] leading-4 text-sky-800">Illustrative assumptions only; not a rental appraisal or verified positive-gearing calculation.</p>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div>
                            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Key evidence
                            </div>
                            <ul className="space-y-1 text-sm text-slate-700">
                              {pick.keyEvidence.slice(0, 3).map(item => <li key={item} className="flex gap-2"><span className="text-emerald-600">•</span><span>{item}</span></li>)}
                            </ul>
                          </div>
                          {pick.materialRisks.length > 0 && (
                            <div>
                              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                                <AlertTriangle className="h-3.5 w-3.5" /> Material risks
                              </div>
                              <ul className="space-y-1 text-sm text-slate-700">
                                {pick.materialRisks.slice(0, 2).map(item => <li key={item} className="flex gap-2"><span className="text-amber-600">•</span><span>{item}</span></li>)}
                              </ul>
                            </div>
                          )}
                          {pick.unknowns.length > 0 && (
                            <div>
                              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                                <HelpCircle className="h-3.5 w-3.5" /> Verify next
                              </div>
                              <p className="text-sm text-slate-700">{pick.unknowns.slice(0, 2).join(" · ")}</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 border-t pt-4">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Evidence confidence</span>
                            <span>{pick.evidenceConfidence}%</span>
                          </div>
                          <Progress value={pick.evidenceConfidence} className="h-1.5" />
                          <div className="flex gap-2 pt-2">
                            <Button asChild className="flex-1 gap-1.5 active:scale-[0.97]">
                              <Link href={`/property/${pick.listing.id}`}>
                                View research <ArrowRight className="h-4 w-4" />
                              </Link>
                            </Button>
                            {pick.listing.listingUrl && (
                              <Button variant="outline" size="icon" asChild title="Open source listing">
                                <a
                                  href={pick.listing.listingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`Open source listing for ${pick.listing.address ?? "this property"}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <section className="grid gap-4 rounded-2xl border bg-muted/30 p-5 sm:grid-cols-3">
          <div className="flex gap-3">
            <Clock3 className="h-5 w-5 shrink-0 text-primary" />
            <div><h3 className="font-semibold">Recency first</h3><p className="mt-1 text-sm text-muted-foreground">Picks refresh weekly and reuse unchanged analysis to control cost.</p></div>
          </div>
          <div className="flex gap-3">
            <Building2 className="h-5 w-5 shrink-0 text-primary" />
            <div><h3 className="font-semibold">Catalogue only</h3><p className="mt-1 text-sm text-muted-foreground">The agents analyse stored listings; browsing this page makes no listing-API calls.</p></div>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <div><h3 className="font-semibold">Evidence bounded</h3><p className="mt-1 text-sm text-muted-foreground">Unknowns remain explicit and unsupported certainty is capped.</p></div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
