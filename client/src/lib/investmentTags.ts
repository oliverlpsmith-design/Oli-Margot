/**
 * Client-side investment tag metadata.
 * Mirrors the server-side investmentClassifier.ts — kept separate so the
 * frontend never imports from server code.
 */

export type InvestmentTag =
  | "deceased_estate"
  | "dual_income"
  | "distressed"
  | "dev_site"
  | "pos_geared";

export const ALL_INVESTMENT_TAGS: InvestmentTag[] = [
  "pos_geared",
  "dual_income",
  "dev_site",
  "deceased_estate",
  "distressed",
];

export const INVESTMENT_TAG_LABELS: Record<InvestmentTag, string> = {
  deceased_estate: "Deceased Estates",
  dual_income:     "Dual Income / Granny Flat",
  distressed:      "Distressed / Mortgagee",
  dev_site:        "Development Sites",
  pos_geared:      "Positive Geared",
};

export const INVESTMENT_TAG_SHORT: Record<InvestmentTag, string> = {
  deceased_estate: "Deceased Estates",
  dual_income:     "Dual Income",
  distressed:      "Mortgagee / Distressed",
  dev_site:        "Dev Sites",
  pos_geared:      "Positive Geared",
};

export const INVESTMENT_TAG_DESCRIPTIONS: Record<InvestmentTag, string> = {
  deceased_estate:
    "Listings with explicit deceased-estate campaigns or sale-context probate, executor, administrator, or beneficiary provenance.",
  dual_income:
    "Listings with a second-dwelling or dual-income signal, at least 450 m² of land, and stored R1–R5 residential zoning.",
  distressed:
    "Listings with explicit mortgagee, lender-possession, court, receiver, liquidator, administrator, or repossession sale provenance.",
  dev_site:
    "Development-evidenced sites in current NSW development-capable zones whose indicative residual land value covers the asking price.",
  pos_geared:
    "Listings with evidenced weekly rent and positive modelled annual cash flow after current-rate finance, vacancy, management, maintenance, rates, and insurance.",
};

export const INVESTMENT_TAG_COLORS: Record<InvestmentTag, string> = {
  pos_geared:      "bg-emerald-500/15 text-emerald-700 border-emerald-300/40 dark:text-emerald-300",
  dual_income:     "bg-blue-500/15 text-blue-700 border-blue-300/40 dark:text-blue-300",
  dev_site:        "bg-purple-500/15 text-purple-700 border-purple-300/40 dark:text-purple-300",
  deceased_estate: "bg-amber-500/15 text-amber-700 border-amber-300/40 dark:text-amber-300",
  distressed:      "bg-rose-500/15 text-rose-700 border-rose-300/40 dark:text-rose-300",
};

export const INVESTMENT_TAG_ICON_EMOJI: Record<InvestmentTag, string> = {
  pos_geared:      "📈",
  dual_income:     "🏠",
  dev_site:        "🏗️",
  deceased_estate: "⚖️",
  distressed:      "🔑",
};

export function parseTags(raw: string | null | undefined): InvestmentTag[] {
  if (!raw) return [];
  return raw.split("|").filter(Boolean) as InvestmentTag[];
}
