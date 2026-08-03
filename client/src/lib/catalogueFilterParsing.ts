export const ACRE_TO_SQM = 4_047;
export const MAX_LAND_ACRES = 500;
export const MAX_LAND_AREA_SQM = ACRE_TO_SQM * MAX_LAND_ACRES;
export const MAX_PRICE_AUD = 1_000_000_000;

export type NumericFilterParseResult =
  | { value: number | undefined; error: null }
  | { value: undefined; error: string };

function emptyResult(): NumericFilterParseResult {
  return { value: undefined, error: null };
}

/**
 * Parse a user-entered AUD price such as "$500,000", "750k", or "1.2m".
 * Blank and zero values mean that the bound is not applied.
 */
export function parsePriceFilter(raw: string): NumericFilterParseResult {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return emptyResult();

  const normalized = trimmed.replace(/[,$\s]/g, "");
  const match = normalized.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!match) {
    return { value: undefined, error: "Enter a price such as $500,000, 750k, or 1.2m." };
  }

  const base = Number(match[1]);
  const multiplier = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1;
  const value = Math.round(base * multiplier);

  if (!Number.isFinite(value) || value < 0) {
    return { value: undefined, error: "Enter a valid positive price." };
  }
  if (value === 0) return emptyResult();
  if (value > MAX_PRICE_AUD) {
    return { value: undefined, error: "Price must be $1 billion or less." };
  }
  return { value, error: null };
}

/**
 * Parse a land-size floor entered in acres or square metres. Examples:
 * "2 acres", "1.5 ac", "8,000 sqm", and "8000 m²". A bare number is
 * treated as square metres for backwards compatibility with the old filter.
 */
export function parseLandSizeFilter(raw: string): NumericFilterParseResult {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return emptyResult();

  const hasAcreUnit = /(?:^|\s)(?:ac|acre|acres)\b/.test(trimmed);
  const hasSqmUnit = /(?:sqm|m2|square\s*(?:metres?|meters?))\b|m²/.test(trimmed);
  if (hasAcreUnit && hasSqmUnit) {
    return { value: undefined, error: "Use either acres or square metres, not both." };
  }

  const normalized = trimmed
    .replace(/,/g, "")
    .replace(/square\s*(?:metres?|meters?)/g, "")
    .replace(/(?:sqm|m2|acres?|ac)\b|m²/g, "")
    .trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return { value: undefined, error: "Enter a land size such as 2 acres or 8,000 sqm." };
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    return { value: undefined, error: "Enter a valid positive land size." };
  }
  if (amount === 0) return emptyResult();

  const squareMetres = hasAcreUnit ? amount * ACRE_TO_SQM : amount;
  if (squareMetres > MAX_LAND_AREA_SQM) {
    return {
      value: undefined,
      error: `Land size cannot exceed ${MAX_LAND_ACRES} acres (${MAX_LAND_AREA_SQM.toLocaleString("en-AU")} sqm).`,
    };
  }

  return { value: Math.round(squareMetres), error: null };
}

export function formatLandFilterConversion(squareMetres: number | undefined): string | null {
  if (!squareMetres) return null;
  const acres = squareMetres / ACRE_TO_SQM;
  return `${squareMetres.toLocaleString("en-AU")} sqm · ${acres.toLocaleString("en-AU", { maximumFractionDigits: 2 })} acres`;
}
