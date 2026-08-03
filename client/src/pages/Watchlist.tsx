import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatSqm, VERDICT_META, type Verdict } from "@/lib/analysis";
import { trpc } from "@/lib/trpc";
import { Bookmark, ExternalLink, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { SUBDIVISION_BROWSE_HREF } from "@shared/subdivisionDefaults";

export default function Watchlist() {
  const utils = trpc.useUtils();
  const saved = trpc.property.listSaved.useQuery();
  const remove = trpc.property.remove.useMutation({
    onSuccess: () => {
      toast.success("Removed from watchlist");
      utils.property.listSaved.invalidate();
    },
  });
  const updateNotes = trpc.property.updateNotes.useMutation({
    onSuccess: () => {
      toast.success("Notes saved");
      utils.property.listSaved.invalidate();
    },
  });
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});

  return (
    <AppShell>
      <div className="container py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Watchlist</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Shared shortlist — properties analysed and saved by your team, with research notes.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2 self-start">
            <Link href={SUBDIVISION_BROWSE_HREF}>
              <Search className="h-4 w-4" /> Browse 100+ acre subdivision
            </Link>
          </Button>
        </div>

        {saved.isLoading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        )}

        {saved.data && saved.data.length === 0 && (
          <div className="mt-12 rounded-xl border border-dashed bg-muted/30 py-16 px-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Bookmark className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-4 font-medium text-foreground">No saved properties yet</h2>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">
              Browse the subdivision catalogue, open a promising property analysis,
              and save it here with your due-diligence notes.
            </p>
            <Button asChild className="mt-5 gap-2">
              <Link href={SUBDIVISION_BROWSE_HREF}>
                <Search className="h-4 w-4" /> Browse 100+ acre subdivision results
              </Link>
            </Button>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {saved.data?.map(item => {
            const verdict = item.verdict as Verdict;
            const meta = VERDICT_META[verdict];
            return (
              <Card key={item.id}>
                <CardContent className="pt-5">
                  <div className="flex flex-col md:flex-row gap-4">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.address}
                        className="h-32 w-full md:w-48 object-cover rounded-lg shrink-0"
                        loading="lazy"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{item.address}</p>
                          <p className="text-sm text-primary font-medium mt-0.5">
                            {item.priceDisplay ?? "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        <span>Land: {formatSqm(item.landAreaSqm ? Number(item.landAreaSqm) : null)}</span>
                        <span>Min lot: {item.minLotSizeLabel ?? "—"}</span>
                        <span>Zone: {item.zoneCode ?? "—"}</span>
                        <span>Potential lots: {item.potentialLots ?? "—"}</span>
                        {item.lgaName && <span>LGA: {item.lgaName}</span>}
                      </div>
                      <Textarea
                        className="mt-3 text-sm"
                        rows={2}
                        placeholder="Research notes…"
                        value={editingNotes[item.id] ?? item.notes ?? ""}
                        onChange={e =>
                          setEditingNotes(prev => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                      <div className="mt-2 flex items-center gap-2">
                        {editingNotes[item.id] !== undefined &&
                          editingNotes[item.id] !== (item.notes ?? "") && (
                            <Button
                              size="sm"
                              disabled={updateNotes.isPending}
                              onClick={() =>
                                updateNotes.mutate({ id: item.id, notes: editingNotes[item.id] })
                              }
                            >
                              Save notes
                            </Button>
                          )}
                        {item.listingUrl && (
                          <Button size="sm" variant="outline" asChild className="gap-1">
                            <a href={item.listingUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" /> Listing
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive gap-1 ml-auto"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate({ id: item.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
