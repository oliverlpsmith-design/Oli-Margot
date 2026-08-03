/**
 * NSW zoning code helpers shared by the catalogue cards, map popups,
 * zoning-filter presets and the stats-strip zoning mix.
 *
 * Zone families (NSW Standard Instrument LEP):
 *  - R*   residential          → blue
 *  - RU*  rural                → green
 *  - C1–C4 conservation (renamed from former environmental E zones) → amber
 *  - E1–E5 employment and MU1 mixed use → purple
 *  - historical B-series and IN-series codes remain purple for legacy catalogue display only
 *  - everything else (SP*, RE*, W*, …) → grey
 */

export type ZoneFamily = "residential" | "rural" | "environmental" | "business" | "other";

export function zoneFamily(zoneCode: string): ZoneFamily {
  const z = zoneCode.toUpperCase().trim();
  if (/^RU\d/.test(z)) return "rural";
  if (/^R\d/.test(z)) return "residential";
  if (/^C\d/.test(z)) return "environmental";
  if (/^E\d/.test(z) || /^MU/.test(z) || /^B\d/.test(z) || /^IN\d/.test(z)) return "business";
  return "other";
}

/** Tailwind classes for a zoning chip <Badge>, keyed by family. */
export const ZONE_FAMILY_CLASSES: Record<ZoneFamily, string> = {
  residential: "bg-blue-50 text-blue-700 border-blue-200",
  rural: "bg-emerald-50 text-emerald-700 border-emerald-200",
  environmental: "bg-amber-50 text-amber-800 border-amber-200",
  business: "bg-purple-50 text-purple-700 border-purple-200",
  other: "bg-slate-100 text-slate-700 border-slate-300",
};

export function zoneChipClasses(zoneCode: string): string {
  return ZONE_FAMILY_CLASSES[zoneFamily(zoneCode)];
}

/** Inline hex colours for the map InfoWindow (raw HTML, no Tailwind). */
export const ZONE_FAMILY_COLOURS: Record<ZoneFamily, { bg: string; fg: string; border: string }> = {
  residential: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
  rural: { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" },
  environmental: { bg: "#fffbeb", fg: "#92400e", border: "#fde68a" },
  business: { bg: "#faf5ff", fg: "#7e22ce", border: "#e9d5ff" },
  other: { bg: "#f1f5f9", fg: "#334155", border: "#cbd5e1" },
};

/** Quick-select presets for the zoning filter. Codes are matched against the
 * codes actually present in the catalogue before toggling. */
export const ZONE_PRESETS: { label: string; family: ZoneFamily; codes: string[] }[] = [
  { label: "All residential (R1–R5)", family: "residential", codes: ["R1", "R2", "R3", "R4", "R5"] },
  { label: "All rural (RU1–RU6)", family: "rural", codes: ["RU1", "RU2", "RU3", "RU4", "RU5", "RU6"] },
  {
    label: "All conservation (C1–C4)",
    family: "environmental",
    codes: ["C1", "C2", "C3", "C4"],
  },
  {
    label: "All employment / mixed use (E1–E5, MU1)",
    family: "business",
    codes: ["E1", "E2", "E3", "E4", "E5", "MU1"],
  },
];
