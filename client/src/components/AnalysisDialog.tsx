import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSqm, VERDICT_META, type Verdict } from "@/lib/analysis";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Flame,
  HelpCircle,
  Home,
  Landmark,
  Leaf,
  MapPinned,
  Mountain,
  Waves,
  Maximize2,
  Maximize,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type RiskStatus = "clear" | "flagged" | "unknown";

function RiskRow({
  icon: Icon,
  name,
  status,
  detail,
}: {
  icon: typeof Flame;
  name: string;
  status: RiskStatus;
  detail: string | null;
}) {
  const statusMeta =
    status === "flagged"
      ? { icon: AlertTriangle, cls: "text-amber-600", label: "Flagged" }
      : status === "clear"
        ? { icon: CheckCircle2, cls: "text-emerald-600", label: "Clear" }
        : { icon: HelpCircle, cls: "text-muted-foreground", label: "Unknown" };
  const StatusIcon = statusMeta.icon;
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <StatusIcon className={`h-3.5 w-3.5 ${statusMeta.cls}`} />
          <span className={`text-xs ${statusMeta.cls}`}>{statusMeta.label}</span>
        </div>
        {detail && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{detail}</p>}
      </div>
    </div>
  );
}

export default function AnalysisDialog({
  listingId,
  onClose,
}: {
  listingId: number | null;
  onClose: () => void;
}) {
  const analyse = trpc.property.analyse.useMutation({
    onError: err => toast.error(`Analysis failed: ${err.message}`),
  });
  const comparables = trpc.property.comparables.useMutation({
    onError: err => toast.error(`Comparables lookup failed: ${err.message}`),
  });
  const [comparablesRequested, setComparablesRequested] = useState(false);
  const save = trpc.property.save.useMutation({
    onSuccess: () => toast.success("Saved to watchlist"),
    onError: err => toast.error(`Save failed: ${err.message}`),
  });

  useEffect(() => {
    if (listingId !== null) {
      analyse.mutate({ listingId });
      setComparablesRequested(false);
      comparables.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const data = analyse.data;
  const verdict = (data?.analysis.verdict ?? "unknown") as Verdict;
  const meta = VERDICT_META[verdict];

  const lgaName = data?.mls?.lgaName ?? null;
  const loadComparables = () => {
    if (!lgaName) return;
    setComparablesRequested(true);
    comparables.mutate({
      lgaName,
      latitude: data?.detail.geoLocation?.latitude,
      longitude: data?.detail.geoLocation?.longitude,
    });
  };

  const handleSave = () => {
    if (!data) return;
    save.mutate({
      listingId: String(data.detail.id),
      address: data.detail.address?.full ?? data.detail.headline ?? "Unknown address",
      suburb: data.detail.address?.suburb,
      postcode: data.detail.address?.postcode,
      latitude: data.detail.geoLocation?.latitude,
      longitude: data.detail.geoLocation?.longitude,
      priceDisplay: data.detail.price,
      landAreaSqm: data.landAreaSqm ?? undefined,
      minLotSizeSqm: data.mls?.lotSizeSqm ?? undefined,
      minLotSizeLabel: data.mls?.label ?? undefined,
      epiName: data.mls?.epiName ?? undefined,
      lgaName: data.mls?.lgaName ?? undefined,
      zoneCode: data.zoning?.zoneCode ?? undefined,
      zoneDescription: data.zoning?.zoneDescription ?? undefined,
      potentialLots: data.analysis.potentialLots ?? undefined,
      verdict,
      listingUrl: data.detail.listingUrl ?? data.detail.seoUrl,
      imageUrl: data.detail.photos?.[0],
    });
  };

  return (
    <Dialog open={listingId !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subdivision analysis</DialogTitle>
          <DialogDescription>
            Live check against official planning portal minimum lot size and zoning layers.
          </DialogDescription>
        </DialogHeader>

        {analyse.isPending && (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {data && !analyse.isPending && (
          <div className="space-y-4">
            {data.detail.photos?.[0] && (
              <img
                src={data.detail.photos[0]}
                alt="Property"
                className="h-48 w-full object-cover rounded-lg"
              />
            )}
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">{data.detail.address?.full}</p>
                {"category" in data && data.category !== "unknown" && (
                  <Badge
                    className={`shrink-0 gap-1 border ${
                      data.category === "cash_flow"
                        ? "bg-sky-50 text-sky-700 border-sky-200"
                        : "bg-stone-100 text-stone-700 border-stone-300"
                    }`}
                  >
                    {data.category === "cash_flow" ? (
                      <><Home className="h-3 w-3" /> Cash flow</>
                    ) : (
                      <><Mountain className="h-3 w-3" /> Land only</>
                    )}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-primary font-medium">{data.detail.price}</p>
              {"category" in data && data.category === "cash_flow" && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Existing dwelling — rental income can offset holding costs during the DA process.
                </p>
              )}
            </div>

            <div className={`rounded-lg border px-4 py-3 ${meta.className}`}>
              <p className="font-semibold">{meta.label}</p>
              <p className="text-sm mt-1 leading-relaxed">{data.analysis.explanation}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Land area (listing)</p>
                <p className="font-medium text-foreground mt-0.5">{formatSqm(data.landAreaSqm)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Minimum lot size (Planning Portal)</p>
                <p className="font-medium text-foreground mt-0.5">
                  {data.mls?.label ?? "Not mapped for this parcel"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Zoning</p>
                <p className="font-medium text-foreground mt-0.5">
                  {data.zoning?.zoneCode ? (
                    <>
                      <Badge variant="outline" className="mr-1.5">{data.zoning.zoneCode}</Badge>
                      {data.zoning.zoneDescription}
                    </>
                  ) : (
                    "Unavailable"
                  )}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Potential lots (indicative)</p>
                <p className="font-medium text-foreground mt-0.5">
                  {data.analysis.potentialLots ?? "—"}
                  {data.analysis.ratio !== null && (
                    <span className="text-muted-foreground text-xs ml-1.5">
                      ({data.analysis.ratio}× min lot size)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {data.mls?.epiName && (
              <p className="text-xs text-muted-foreground">
                Planning instrument: {data.mls.epiName}
                {data.mls.lgaName ? ` · LGA: ${data.mls.lgaName}` : ""}
              </p>
            )}

            {"risks" in data && data.risks && (
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Constraint layers (live government data)
                </p>
                <div className="mt-1 divide-y">
                  <RiskRow icon={Flame} name="Bushfire prone land" status={data.risks.bushfire.status as RiskStatus} detail={data.risks.bushfire.detail} />
                  <RiskRow icon={Leaf} name="Biodiversity Values Map" status={data.risks.biodiversity.status as RiskStatus} detail={data.risks.biodiversity.detail} />
                  <RiskRow icon={Waves} name="Flood planning area" status={data.risks.flood.status as RiskStatus} detail={data.risks.flood.detail} />
                  <RiskRow icon={Landmark} name="Heritage" status={data.risks.heritage.status as RiskStatus} detail={data.risks.heritage.detail} />
                  <RiskRow icon={AlertTriangle} name="Acid Sulfate Soils" status={data.risks.acidSulfate.status as RiskStatus} detail={data.risks.acidSulfate.detail} />
                  <RiskRow icon={Maximize2} name="Floor Space Ratio (FSR)" status={data.risks.fsr.status as RiskStatus} detail={data.risks.fsr.detail} />
                  <RiskRow icon={Maximize} name="Max Building Height" status={data.risks.buildingHeight.status as RiskStatus} detail={data.risks.buildingHeight.detail} />
                </div>
              </div>
            )}

            {"links" in data && data.links && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <a href={data.links.spatialViewer} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Verify in Spatial Viewer
                </a>
                <a href={data.links.rfsBushfire} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> RFS bushfire check
                </a>
                <a href={data.links.googleMaps} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Google Maps
                </a>
              </div>
            )}

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Subdivision comparables{lgaName ? ` · ${lgaName}` : ""}
                </p>
                {!comparablesRequested && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={loadComparables}
                    disabled={!lgaName}
                  >
                    <MapPinned className="h-3.5 w-3.5" />
                    {lgaName ? "Find nearby subdivision DAs" : "LGA unknown"}
                  </Button>
                )}
              </div>
              {comparables.isPending && (
                <div className="mt-2 space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {comparables.data && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    {comparables.data.comparables.length} subdivision DAs (of {comparables.data.scanned.toLocaleString()} DAs scanned, last 3 years) in {comparables.data.councilName} — sorted by distance.
                  </p>
                  <div className="mt-2 divide-y">
                    {comparables.data.comparables.map(c => (
                      <div key={c.panNumber} className="py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground leading-snug">{c.address}</p>
                          <Badge
                            variant="outline"
                            className={
                              c.status === "Determined"
                                ? "border-emerald-300 text-emerald-700"
                                : "text-muted-foreground"
                            }
                          >
                            {c.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.existingLots !== null && c.proposedLots !== null
                            ? `${c.existingLots} → ${c.proposedLots} lots`
                            : "Lot change unstated"}
                          {c.subdivisionType ? ` · ${c.subdivisionType}` : ""}
                          {c.distanceKm !== null ? ` · ${c.distanceKm} km away` : ""}
                          {c.determinationDate ? ` · determined ${c.determinationDate}` : c.lodgementDate ? ` · lodged ${c.lodgementDate}` : ""}
                          {c.costOfDevelopment ? ` · $${Math.round(c.costOfDevelopment).toLocaleString()} works` : ""}
                        </p>
                      </div>
                    ))}
                    {comparables.data.comparables.length === 0 && (
                      <p className="py-2 text-sm text-muted-foreground">
                        No subdivision DAs found in this council's recent feed.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button onClick={handleSave} disabled={save.isPending} className="gap-1.5">
                <Bookmark className="h-4 w-4" />
                {save.isPending ? "Saving…" : "Save to watchlist"}
              </Button>
              {(data.detail.listingUrl ?? data.detail.seoUrl) && (
                <Button variant="outline" asChild className="gap-1.5">
                  <a
                    href={data.detail.listingUrl ?? data.detail.seoUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View listing
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
