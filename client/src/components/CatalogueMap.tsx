/// <reference types="@types/google.maps" />

import { MapView } from "@/components/Map";
import { Skeleton } from "@/components/ui/skeleton";
import { zoneFamily, ZONE_FAMILY_COLOURS } from "@/lib/zones";
import { useEffect, useRef, useState } from "react";

export interface MapListing {
  id: number;
  listingId: string;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  suburb: string | null;
  postcode: string | null;
  verdict: string | null;
  score: number | null;
  category: string | null;
  landAreaSqm: string | null;
  zoneCode?: string | null;
  priceDisplay: string | null;
  priceNumeric: string | null;
  potentialLots: number | null;
  listedAt: Date | null;
  firstSeenAt: Date | null;
  listingUrl: string | null;
}

/** Marker colour by subdivision score: green high, amber medium, red low/unknown. */
export function markerColour(score: number | null): { fill: string; label: string } {
  if (score !== null && score >= 75) return { fill: "#059669", label: "high" }; // emerald-600
  if (score !== null && score >= 50) return { fill: "#d97706", label: "medium" }; // amber-600
  return { fill: "#dc2626", label: "low" }; // red-600
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAud(value: number): string {
  return value.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

function daysOnMarket(listedAt: Date | null, firstSeenAt: Date | null): number | null {
  const base = listedAt ?? firstSeenAt;
  if (!base) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(base).getTime()) / 86_400_000));
}

/** Build the popup (InfoWindow) HTML for a listing. All text is escaped. */
export function buildPopupHtml(l: MapListing): string {
  const land = l.landAreaSqm ? Number(l.landAreaSqm) : null;
  const price = l.priceNumeric != null ? Number(l.priceNumeric) : null;
  const ppl =
    price !== null && Number.isFinite(price) && price > 0 && l.potentialLots != null && l.potentialLots >= 1
      ? Math.round(price / l.potentialLots)
      : null;
  const dom = daysOnMarket(l.listedAt, l.firstSeenAt);
  const verdictLabel =
    l.verdict === "subdividable" ? "Subdividable" : l.verdict === "marginal" ? "Marginal" : l.verdict ?? "Unknown";
  const addr = escapeHtml(l.address ?? `${l.suburb ?? "NSW"} ${l.postcode ?? ""}`.trim());
  const rows: string[] = [];
  rows.push(`<div style="font-weight:600;font-size:13px;margin-bottom:4px;max-width:240px">${addr}</div>`);
  rows.push(
    `<div style="font-size:12px;margin-bottom:2px"><b>${escapeHtml(verdictLabel)}</b> · Score ${l.score ?? "—"}${l.potentialLots ? ` · ${l.potentialLots} potential lots` : ""}</div>`,
  );
  if (l.zoneCode) {
    const c = ZONE_FAMILY_COLOURS[zoneFamily(l.zoneCode)];
    rows.push(
      `<div style="font-size:12px;margin-bottom:2px"><span style="display:inline-block;padding:1px 6px;border-radius:9999px;font-weight:600;font-size:11px;background:${c.bg};color:${c.fg};border:1px solid ${c.border}">${escapeHtml(l.zoneCode)}</span> <span style="color:#6b7280">zoning</span></div>`,
    );
  }
  if (l.priceDisplay) rows.push(`<div style="font-size:12px">${escapeHtml(l.priceDisplay)}</div>`);
  if (ppl !== null) rows.push(`<div style="font-size:12px;color:#059669">${formatAud(ppl)} per potential lot</div>`);
  if (land !== null)
    rows.push(`<div style="font-size:12px">${land.toLocaleString("en-AU")} m² land</div>`);
  if (dom !== null)
    rows.push(`<div style="font-size:12px;color:#6b7280">${dom === 0 ? "Listed today" : `Listed ${dom} day${dom === 1 ? "" : "s"} ago`}</div>`);
  if (l.listingUrl)
    rows.push(
      `<div style="margin-top:6px"><a href="${escapeHtml(l.listingUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#2563eb;text-decoration:underline">View on realestate.com.au</a></div>`,
    );
  return `<div style="font-family:inherit;line-height:1.45">${rows.join("")}</div>`;
}

const NSW_CENTER = { lat: -32.5, lng: 147.0 };

interface CatalogueMapProps {
  listings: MapListing[];
  loading: boolean;
}

export default function CatalogueMap({ listings, loading }: CatalogueMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  // Only auto-fit bounds on the first render of a data set after an apply,
  // so panning/zooming isn't yanked away by background refetches.
  const lastFitKeyRef = useRef<string>("");

  // If the maps script hasn't produced a ready map after 12s, surface a hint
  // instead of an indefinitely blank panel (e.g. restricted preview origins).
  useEffect(() => {
    if (mapReady) return;
    const t = window.setTimeout(() => {
      if (!mapRef.current) setMapFailed(true);
    }, 12_000);
    return () => window.clearTimeout(t);
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.google) return;

    // Clear previous markers
    markersRef.current.forEach((m) => {
      m.map = null;
    });
    markersRef.current = [];
    infoWindowRef.current?.close();

    if (!listings.length) return;

    if (!infoWindowRef.current) {
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }
    const infoWindow = infoWindowRef.current;
    const bounds = new window.google.maps.LatLngBounds();

    listings.forEach((l) => {
      const lat = l.latitude != null ? Number(l.latitude) : NaN;
      const lng = l.longitude != null ? Number(l.longitude) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const { fill } = markerColour(l.score);

      const pin = document.createElement("div");
      pin.style.cssText = `width:14px;height:14px;border-radius:9999px;background:${fill};border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:pointer`;
      pin.setAttribute("aria-label", l.address ?? "Listing");

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat, lng },
        content: pin,
        title: l.address ?? undefined,
      });
      marker.addListener("click", () => {
        infoWindow.setContent(buildPopupHtml(l));
        infoWindow.open({ map, anchor: marker });
      });
      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
    });

    const fitKey = `${listings.length}:${listings[0]?.listingId ?? ""}:${listings[listings.length - 1]?.listingId ?? ""}`;
    if (markersRef.current.length > 0 && fitKey !== lastFitKeyRef.current) {
      lastFitKeyRef.current = fitKey;
      if (markersRef.current.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(13);
      } else {
        map.fitBounds(bounds, 48);
      }
    }
  }, [listings, mapReady]);

  return (
    <div className="relative rounded-xl overflow-hidden border">
      <MapView
        className="h-[560px]"
        initialCenter={NSW_CENTER}
        initialZoom={6}
        onMapReady={(map) => {
          mapRef.current = map;
          setMapReady(true);
        }}
      />
      {loading && (
        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
          <Skeleton className="h-8 w-40" />
        </div>
      )}
      {mapFailed && !mapReady && (
        <div className="absolute inset-0 bg-background/90 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground max-w-sm">
            The map couldn't load in this environment. Please try refreshing, or use the
            published site — the list view remains fully available.
          </p>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-4 left-4 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm space-y-1">
        <p className="font-medium text-foreground mb-1">Subdivision score</p>
        <p className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border border-white shadow" style={{ background: "#059669" }} />
          75+ (high)
        </p>
        <p className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border border-white shadow" style={{ background: "#d97706" }} />
          50–74 (medium)
        </p>
        <p className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border border-white shadow" style={{ background: "#dc2626" }} />
          Below 50 / unscored
        </p>
      </div>
    </div>
  );
}
