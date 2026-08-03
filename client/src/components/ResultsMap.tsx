import { MapView } from "@/components/Map";
import type { Verdict } from "@/lib/analysis";
import { useEffect, useRef } from "react";

export interface MapListing {
  id: number;
  address: string;
  price?: string;
  latitude: number;
  longitude: number;
  verdict?: Verdict;
}

const VERDICT_COLOR: Record<Verdict, string> = {
  subdividable: "#059669",
  marginal: "#d97706",
  not_subdividable: "#e11d48",
  unknown: "#64748b",
};

export default function ResultsMap({
  listings,
  onSelect,
}: {
  listings: MapListing[];
  onSelect: (id: number) => void;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const renderMarkers = () => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => (m.map = null));
    markersRef.current = [];
    if (listings.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const listing of listings) {
      const pos = { lat: listing.latitude, lng: listing.longitude };
      bounds.extend(pos);
      const pin = document.createElement("div");
      const color = VERDICT_COLOR[listing.verdict ?? "unknown"];
      pin.style.cssText = `background:${color};width:16px;height:16px;border-radius:9999px;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;`;
      pin.title = `${listing.address}${listing.price ? ` — ${listing.price}` : ""}`;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
        content: pin,
        title: pin.title,
      });
      marker.addListener("click", () => onSelect(listing.id));
      markersRef.current.push(marker);
    }
    map.fitBounds(bounds, 48);
  };

  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings]);

  return (
    <MapView
      className="h-[480px] w-full rounded-xl overflow-hidden border"
      initialCenter={{ lat: -33.8688, lng: 151.2093 }}
      initialZoom={6}
      onMapReady={map => {
        mapRef.current = map;
        renderMarkers();
      }}
    />
  );
}
