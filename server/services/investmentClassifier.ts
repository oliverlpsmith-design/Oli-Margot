/**
 * Investment category classifier — deterministic and auditable.
 *
 * The pure classifier consumes listing and state planning values already held by
 * the nightly sweep/database. It never fetches additional data. Automatic tags
 * are intentionally conservative: missing evidence fails closed for categories
 * that claim legal provenance, planning permissibility, or financial feasibility.
 */

export type InvestmentTag =
  | "deceased_estate"
  | "dual_income"
  | "distressed"
  | "dev_site"
  | "pos_geared";

/** Version 4 adds persisted QLD source provenance and fail-safe legacy reclassification. */
export const CURRENT_CLASSIFIER_VERSION = 4;

export const INVESTMENT_TAG_LABELS: Record<InvestmentTag, string> = {
  deceased_estate: "Deceased Estate",
  dual_income: "Dual Income / Granny Flat",
  distressed: "Distressed / Mortgagee",
  dev_site: "Development Site",
  pos_geared: "Positive Geared",
};

export const INVESTMENT_TAG_DESCRIPTIONS: Record<InvestmentTag, string> = {
  deceased_estate: "Listings with explicit deceased-estate, probate, or executor-sale provenance.",
  dual_income: "Listings with a dual-income signal, at least 450 m² of land, and a stored state-specific residential-zone candidate. Council verification is still required.",
  distressed: "Listings with explicit mortgagee, receiver, court, repossession, or lender-sale provenance.",
  dev_site: "Development listings that pass current-zone, approval-evidence, and residual-land-value screens.",
  pos_geared: "Listings with advertised weekly rent that remain cash-flow positive after modelled operating costs and current investor finance.",
};

const DUAL_INCOME_RE =
  /granny\s+flat|granny\s+potential|dual\s+occupancy|dual\s+income|secondary\s+dwelling|dual[- ]living|in-law\s+suite|self[- ]contained\s+(unit|studio|flat|cottage|dwelling)|second\s+dwelling|secondary\s+suite|additional\s+dwelling|dual\s+residence|two\s+dwellings|two\s+homes|two\s+houses|two\s+units\s+on|separate\s+dwelling|detached\s+granny|duplex|dual\s+occ|house\s+[+&]\s+granny|house\s+and\s+granny|house\s+with\s+granny|income\s+producing.*flat|flat.*income|rental\s+income.*granny|granny.*rental/i;

const DEVELOPMENT_EVIDENCE_RE =
  /\b(d\.?a\.?\s+(?:approved|approval|consent)|development\s+consent|approved\s+(?:plans?|development|project)|construction\s+certificate|development\s+site|townhouse\s+(?:site|development)|unit\s+(?:site|development)|apartment\s+(?:site|development)|mixed[- ]use\s+(?:site|development))\b/i;

const RESIDENTIAL_ZONES = new Set(["R1", "R2", "R3", "R4", "R5"]);
const CURRENT_EMPLOYMENT_ZONES = new Set(["E1", "E2", "E3", "E4", "E5"]);

export interface ClassifiableRow {
  /** Defaults to NSW for backward compatibility with stored rows and tests. */
  state?: "NSW" | "QLD" | null;
  headline: string | null;
  /** First portion of the listing description for richer evidence matching. */
  description?: string | null;
  priceNumeric: string | number | null;
  bedrooms: number | null;
  zoneCode: string | null;
  propertyType: string | null;
  landAreaSqm?: number | null;
  fsrValue?: string | number | null;
  /** Optional trusted weekly-rent input; otherwise rent is parsed from listing text. */
  weeklyRent?: string | number | null;
  /** QLD council-machine coverage is required for planning-gated automatic tags. */
  planningEvidence?: "council_machine" | "council_partial" | "manual_review" | "state_machine" | null;
}

function listingText(row: Pick<ClassifiableRow, "headline" | "description">): string {
  return `${row.headline ?? ""} ${(row.description ?? "").slice(0, 600)}`.trim();
}

function normaliseNswZoneCode(zoneCode: string | null | undefined): string | null {
  if (!zoneCode) return null;
  const match = zoneCode.toUpperCase().match(/\b(?:E[1-5]|R[1-5]|MU1)\b/);
  return match?.[0] ?? null;
}

export type QldZoneFamily =
  | "residential_low"
  | "residential_general"
  | "residential_medium"
  | "residential_high"
  | "rural_residential"
  | "mixed_use"
  | "centre"
  | "emerging_community"
  | "township"
  | "rural"
  | "other";

export interface NormalisedPlanningZone {
  state: "NSW" | "QLD";
  canonicalCode: string | null;
  family: QldZoneFamily | "nsw_residential" | "nsw_employment" | "nsw_mixed_use" | "other" | null;
  residentialCandidate: boolean;
  developmentCandidate: boolean;
  requiresCouncilVerification: boolean;
}

/**
 * Normalize QLD statutory zone names for candidate screening only. Queensland
 * councils retain their own planning schemes, assessment tables, overlays and
 * minimum-lot rules; a family match is not a use or subdivision entitlement.
 */
export function normalisePlanningZone(
  stateInput: ClassifiableRow["state"],
  zoneCode: string | null | undefined,
): NormalisedPlanningZone {
  const state = stateInput === "QLD" ? "QLD" : "NSW";
  if (state === "NSW") {
    const canonicalCode = normaliseNswZoneCode(zoneCode);
    const family = canonicalCode
      ? RESIDENTIAL_ZONES.has(canonicalCode)
        ? "nsw_residential"
        : CURRENT_EMPLOYMENT_ZONES.has(canonicalCode)
          ? "nsw_employment"
          : canonicalCode === "MU1"
            ? "nsw_mixed_use"
            : "other"
      : null;
    return {
      state,
      canonicalCode,
      family,
      residentialCandidate: Boolean(canonicalCode && RESIDENTIAL_ZONES.has(canonicalCode)),
      developmentCandidate: Boolean(
        canonicalCode &&
          (RESIDENTIAL_ZONES.has(canonicalCode) ||
            CURRENT_EMPLOYMENT_ZONES.has(canonicalCode) ||
            canonicalCode === "MU1"),
      ),
      requiresCouncilVerification: false,
    };
  }

  const text = (zoneCode ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
  let family: QldZoneFamily | null = null;
  if (/\brural residential\b/.test(text)) family = "rural_residential";
  else if (/\bhigh density residential\b/.test(text)) family = "residential_high";
  else if (/\b(?:low medium|medium) density residential\b/.test(text)) family = "residential_medium";
  else if (/\blow density residential\b/.test(text)) family = "residential_low";
  else if (/\b(?:general )?residential\b/.test(text)) family = "residential_general";
  else if (/\bmixed use\b/.test(text)) family = "mixed_use";
  else if (/\b(?:(?:principal|major|district|local|neighbourhood|specialised) )?centre\b/.test(text)) family = "centre";
  else if (/\bemerging community\b/.test(text)) family = "emerging_community";
  else if (/\btownship\b/.test(text)) family = "township";
  else if (/\brural\b/.test(text)) family = "rural";
  else if (text) family = "other";

  const residentialCandidate = Boolean(
    family &&
      [
        "residential_low",
        "residential_general",
        "residential_medium",
        "residential_high",
        "rural_residential",
      ].includes(family),
  );
  const developmentCandidate = Boolean(
    family &&
      [
        "residential_low",
        "residential_general",
        "residential_medium",
        "residential_high",
        "rural_residential",
        "mixed_use",
        "centre",
        "emerging_community",
        "township",
      ].includes(family),
  );
  return {
    state,
    canonicalCode: family ? `QLD:${family.toUpperCase()}` : null,
    family,
    residentialCandidate,
    developmentCandidate,
    requiresCouncilVerification: true,
  };
}

function parsePositiveNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (!value) return null;
  const parsed = Number(String(value).replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export type DeceasedEstateProvenanceTier =
  | "tier_1_legal_process"
  | "tier_2_explicit_estate_campaign";

export interface DeceasedEstateProvenance {
  qualifies: boolean;
  tier: DeceasedEstateProvenanceTier | null;
  signal: string | null;
}

const DECEASED_LEGAL_PROCESS_PATTERNS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "probate sale", pattern: /\bprobate\s+(?:sale|property|auction)\b/i },
  { signal: "estate of the late", pattern: /\bestate\s+of\s+(?:the\s+)?late\b/i },
  { signal: "legal personal representative", pattern: /\blegal\s+personal\s+representative\b/i },
  { signal: "executor sale or instruction", pattern: /\bexecutor(?:s|'s)?\b.{0,80}\b(?:sale|selling|auction|instructed|instructions?|appointed|vendor)\b|\b(?:sale|selling|auction|instructed|instructions?|appointed|vendor)\b.{0,80}\bexecutor(?:s|'s)?\b/i },
  { signal: "administrator estate sale", pattern: /\badministrator(?:s|'s)?\b.{0,80}\b(?:deceased|estate|probate|sale|auction)\b|\b(?:deceased|estate|probate)\b.{0,80}\badministrator(?:s|'s)?\b/i },
  { signal: "estate instruction", pattern: /\b(?:on\s+behalf\s+of|instructed\s+by|instructions?\s+of)\s+(?:the\s+)?estate\b/i },
];

const DECEASED_EXPLICIT_CAMPAIGN_PATTERNS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "deceased estate", pattern: /\bdeceased[- ]estate\b/i },
  { signal: "estate liquidation", pattern: /\bestate\s+liquidation\b/i },
  { signal: "beneficiary sale", pattern: /\bbeneficiar(?:y|ies)\s+(?:sale|instructed|auction)\b/i },
];

/**
 * Require an explicit legal-role/process phrase or an unambiguous deceased-
 * estate campaign phrase. Generic uses of “estate” and isolated “executor”
 * mentions do not qualify.
 */
export function assessDeceasedEstateProvenance(
  row: Pick<ClassifiableRow, "headline" | "description">,
): DeceasedEstateProvenance {
  const text = listingText(row);
  for (const candidate of DECEASED_LEGAL_PROCESS_PATTERNS) {
    if (candidate.pattern.test(text)) {
      return { qualifies: true, tier: "tier_1_legal_process", signal: candidate.signal };
    }
  }
  for (const candidate of DECEASED_EXPLICIT_CAMPAIGN_PATTERNS) {
    if (candidate.pattern.test(text)) {
      return { qualifies: true, tier: "tier_2_explicit_estate_campaign", signal: candidate.signal };
    }
  }
  return { qualifies: false, tier: null, signal: null };
}

export type DistressedProvenanceTier =
  | "tier_1_possession_or_court"
  | "tier_2_explicit_lender_or_insolvency_sale";

export interface DistressedProvenance {
  qualifies: boolean;
  tier: DistressedProvenanceTier | null;
  signal: string | null;
}

const DISTRESSED_TIER_1_PATTERNS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "mortgagee in possession", pattern: /\bmortgagee[- ]in[- ]possession\b/i },
  { signal: "court ordered sale", pattern: /\bcourt[- ]ordered\s+(?:sale|auction)\b/i },
  { signal: "sheriff sale", pattern: /\bsheriff(?:'s)?\s+(?:sale|auction)\b/i },
  { signal: "receiver and manager", pattern: /\breceiver(?:s)?\s+and\s+manager(?:s)?\b/i },
  { signal: "repossession", pattern: /\b(?:bank\s+)?repossession\b|\brepossessed\s+property\b/i },
];

const DISTRESSED_TIER_2_PATTERNS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "mortgagee sale", pattern: /\bmortgagee(?:'s)?\s+(?:sale|auction)\b/i },
  { signal: "bank instructed sale", pattern: /\b(?:bank|lender)[- ]instructed\s+(?:sale|auction|campaign)\b|\b(?:sale|auction)\s+on\s+instructions?\s+from\s+(?:the\s+)?(?:bank|lender)\b/i },
  { signal: "bank sale", pattern: /\b(?:bank|lender)\s+(?:sale|auction)\b/i },
  { signal: "receivership sale", pattern: /\breceivership\s+(?:sale|auction)\b|\bsale\s+by\s+(?:the\s+)?receiver\b/i },
  { signal: "liquidator sale", pattern: /\b(?:liquidator|administrator)[- ]instructed\s+(?:sale|auction)\b|\bsale\s+by\s+(?:the\s+)?(?:liquidator|administrator)\b/i },
];

/** Generic urgency, “must sell”, price reduction, and motivated-vendor copy is excluded. */
export function assessDistressedProvenance(
  row: Pick<ClassifiableRow, "headline" | "description">,
): DistressedProvenance {
  const text = listingText(row);
  for (const candidate of DISTRESSED_TIER_1_PATTERNS) {
    if (candidate.pattern.test(text)) {
      return { qualifies: true, tier: "tier_1_possession_or_court", signal: candidate.signal };
    }
  }
  for (const candidate of DISTRESSED_TIER_2_PATTERNS) {
    if (candidate.pattern.test(text)) {
      return { qualifies: true, tier: "tier_2_explicit_lender_or_insolvency_sale", signal: candidate.signal };
    }
  }
  return { qualifies: false, tier: null, signal: null };
}

/**
 * Current screening assumptions as at 2026-08-01. The 7.20% investor P&I rate
 * is documented in research/cash-flow-rate-source.md. These are conservative
 * catalogue-ranking assumptions, not personalised finance advice.
 */
export const NET_CASH_FLOW_ASSUMPTIONS = {
  investorInterestRate: 0.072,
  loanToValueRatio: 0.8,
  loanTermYears: 30,
  vacancyPctOfGrossRent: 0.04,
  managementPctOfCollectedRent: 0.07,
  maintenancePctOfPropertyValue: 0.01,
  councilRatesPctOfPropertyValue: 0.004,
  minimumAnnualCouncilRates: 1_500,
  insurancePctOfPropertyValue: 0.002,
  minimumAnnualInsurance: 1_200,
} as const;

export interface NetCashFlowAssessment {
  qualifies: boolean;
  askingPrice: number | null;
  weeklyRent: number | null;
  grossAnnualRent: number | null;
  effectiveRentAfterVacancy: number | null;
  managementCost: number | null;
  maintenanceCost: number | null;
  councilRates: number | null;
  insuranceCost: number | null;
  annualDebtService: number | null;
  annualNetCashFlow: number | null;
}

/**
 * Parse only rent-context weekly amounts. A price followed by “per week” is
 * insufficient unless the nearby copy identifies rent, lease, tenancy, return,
 * income, or an appraisal. For ranges, the lower amount is retained.
 */
export function parseAdvertisedWeeklyRent(text: string | null | undefined): number | null {
  if (!text) return null;
  const sample = text.slice(0, 600);
  const patterns = [
    /\b(?:combined|total)\s+(?:weekly\s+)?(?:rent|rental\s+income|return)\s*(?:of|at|is|:|-)?\s*\$\s*([\d,]{3,5})(?:\s*(?:-|to)\s*\$?\s*[\d,]{3,5})?\s*(?:p\.?w\.?|per\s+week|weekly)\b/i,
    /\b(?:currently\s+)?(?:leased|rented|tenanted)\s*(?:at|for|on)?\s*\$\s*([\d,]{3,5})(?:\s*(?:-|to)\s*\$?\s*[\d,]{3,5})?\s*(?:p\.?w\.?|per\s+week|weekly)\b/i,
    /\b(?:rent(?:al)?|rental\s+return|rental\s+income|weekly\s+return|market\s+rent|rent\s+appraisal|rental\s+appraisal|estimated\s+rent|potential\s+rent)\b.{0,60}?\$\s*([\d,]{3,5})(?:\s*(?:-|to)\s*\$?\s*[\d,]{3,5})?\s*(?:p\.?w\.?|per\s+week|weekly)\b/i,
    /\$\s*([\d,]{3,5})(?:\s*(?:-|to)\s*\$?\s*[\d,]{3,5})?\s*(?:p\.?w\.?|per\s+week|weekly)\b.{0,60}?\b(?:rent(?:al)?|leased|rented|tenanted|return|income|appraisal)\b/i,
  ];
  for (const pattern of patterns) {
    const value = Number(sample.match(pattern)?.[1]?.replace(/,/g, ""));
    if (Number.isFinite(value) && value >= 100 && value <= 10_000) return value;
  }
  return null;
}

function annualPrincipalAndInterest(loanAmount: number, annualRate: number, termYears: number): number {
  const monthlyRate = annualRate / 12;
  const payments = termYears * 12;
  if (monthlyRate <= 0) return loanAmount / termYears;
  const monthlyPayment = loanAmount * monthlyRate * (1 + monthlyRate) ** payments /
    ((1 + monthlyRate) ** payments - 1);
  return monthlyPayment * 12;
}

export function assessNetCashFlow(
  row: Pick<ClassifiableRow, "headline" | "description" | "priceNumeric" | "weeklyRent">,
): NetCashFlowAssessment {
  const askingPrice = parsePositiveNumber(row.priceNumeric);
  const weeklyRent = parsePositiveNumber(row.weeklyRent) ?? parseAdvertisedWeeklyRent(listingText(row));
  if (!askingPrice || !weeklyRent) {
    return {
      qualifies: false,
      askingPrice,
      weeklyRent,
      grossAnnualRent: null,
      effectiveRentAfterVacancy: null,
      managementCost: null,
      maintenanceCost: null,
      councilRates: null,
      insuranceCost: null,
      annualDebtService: null,
      annualNetCashFlow: null,
    };
  }

  const assumptions = NET_CASH_FLOW_ASSUMPTIONS;
  const grossAnnualRent = weeklyRent * 52;
  const effectiveRentAfterVacancy = grossAnnualRent * (1 - assumptions.vacancyPctOfGrossRent);
  const managementCost = effectiveRentAfterVacancy * assumptions.managementPctOfCollectedRent;
  const maintenanceCost = askingPrice * assumptions.maintenancePctOfPropertyValue;
  const councilRates = Math.max(
    assumptions.minimumAnnualCouncilRates,
    askingPrice * assumptions.councilRatesPctOfPropertyValue,
  );
  const insuranceCost = Math.max(
    assumptions.minimumAnnualInsurance,
    askingPrice * assumptions.insurancePctOfPropertyValue,
  );
  const annualDebtService = annualPrincipalAndInterest(
    askingPrice * assumptions.loanToValueRatio,
    assumptions.investorInterestRate,
    assumptions.loanTermYears,
  );
  const annualNetCashFlow =
    effectiveRentAfterVacancy -
    managementCost -
    maintenanceCost -
    councilRates -
    insuranceCost -
    annualDebtService;

  return {
    qualifies: annualNetCashFlow > 0,
    askingPrice,
    weeklyRent,
    grossAnnualRent: Math.round(grossAnnualRent),
    effectiveRentAfterVacancy: Math.round(effectiveRentAfterVacancy),
    managementCost: Math.round(managementCost),
    maintenanceCost: Math.round(maintenanceCost),
    councilRates: Math.round(councilRates),
    insuranceCost: Math.round(insuranceCost),
    annualDebtService: Math.round(annualDebtService),
    annualNetCashFlow: Math.round(annualNetCashFlow),
  };
}

function parseApprovedDwellingCount(text: string): number | null {
  const patterns = [
    /\b(?:approved|approval|consent|plans?|development)\s+(?:is\s+)?(?:for\s+)?(?:up\s+to\s+)?(\d{1,3})\s*(?:townhouses?|apartments?|units?|dwellings?|villas?|terraces?)\b/i,
    /\b(?:up\s+to\s+)?(\d{1,3})\s*(?:townhouses?|apartments?|units?|dwellings?|villas?|terraces?)\s+(?:development|site|approval|approved)\b/i,
  ];
  for (const pattern of patterns) {
    const count = Number(text.match(pattern)?.[1]);
    if (Number.isInteger(count) && count >= 2 && count <= 200) return count;
  }
  return null;
}

export function isDevelopmentZone(
  zoneCode: string | null | undefined,
  state: ClassifiableRow["state"] = "NSW",
): boolean {
  return normalisePlanningZone(state, zoneCode).developmentCandidate;
}

/**
 * Conservative screening constants, not a site-specific valuation. The model
 * includes construction, soft costs, contingency, sales costs, target margin,
 * site/approval allowance, and acquisition costs before comparing to price.
 */
export const RESIDUAL_LAND_VALUE_ASSUMPTIONS = {
  saleableEfficiency: 0.8,
  averageDwellingGfaSqm: 110,
  grossRealisationPerSqm: 7_500,
  hardConstructionPerSqm: 3_200,
  softCostsPctOfHardCosts: 0.15,
  contingencyPctOfHardCosts: 0.05,
  sellingCostsPctOfGrv: 0.03,
  targetMarginPctOfGrv: 0.2,
  fixedSiteAndApprovalCosts: 150_000,
  acquisitionCostsPct: 0.05,
} as const;

export interface ResidualLandValueAssessment {
  qualifies: boolean;
  residualLandValue: number | null;
  modelledGfaSqm: number | null;
  explicitDwellingCount: number | null;
  basis: "fsr" | "approved_yield" | "fsr_and_approved_yield" | null;
}

/**
 * Model an indicative residual land value from stored FSR or an explicit
 * approved dwelling count. When both are present the lower GFA is used.
 */
export function assessResidualLandValue(
  row: Pick<ClassifiableRow, "description" | "headline" | "priceNumeric" | "landAreaSqm" | "fsrValue">,
): ResidualLandValueAssessment {
  const text = listingText(row);
  const explicitDwellingCount = parseApprovedDwellingCount(text);
  const fsr = parsePositiveNumber(row.fsrValue);
  const landAreaSqm = parsePositiveNumber(row.landAreaSqm);

  const fsrGfa = fsr && landAreaSqm
    ? landAreaSqm * fsr * RESIDUAL_LAND_VALUE_ASSUMPTIONS.saleableEfficiency
    : null;
  const approvedYieldGfa = explicitDwellingCount
    ? explicitDwellingCount * RESIDUAL_LAND_VALUE_ASSUMPTIONS.averageDwellingGfaSqm
    : null;

  const modelledGfaSqm = fsrGfa && approvedYieldGfa
    ? Math.min(fsrGfa, approvedYieldGfa)
    : fsrGfa ?? approvedYieldGfa;
  const basis: ResidualLandValueAssessment["basis"] = fsrGfa && approvedYieldGfa
    ? "fsr_and_approved_yield"
    : fsrGfa
      ? "fsr"
      : approvedYieldGfa
        ? "approved_yield"
        : null;

  const askingPrice = parsePositiveNumber(row.priceNumeric);
  if (!modelledGfaSqm || modelledGfaSqm < 220 || !askingPrice) {
    return {
      qualifies: false,
      residualLandValue: null,
      modelledGfaSqm: modelledGfaSqm ?? null,
      explicitDwellingCount,
      basis,
    };
  }

  const assumptions = RESIDUAL_LAND_VALUE_ASSUMPTIONS;
  const grv = modelledGfaSqm * assumptions.grossRealisationPerSqm;
  const hardCosts = modelledGfaSqm * assumptions.hardConstructionPerSqm;
  const residualBeforeAcquisition =
    grv -
    hardCosts -
    hardCosts * assumptions.softCostsPctOfHardCosts -
    hardCosts * assumptions.contingencyPctOfHardCosts -
    grv * assumptions.sellingCostsPctOfGrv -
    grv * assumptions.targetMarginPctOfGrv -
    assumptions.fixedSiteAndApprovalCosts;
  const residualLandValue = Math.max(
    0,
    residualBeforeAcquisition / (1 + assumptions.acquisitionCostsPct),
  );

  return {
    qualifies: residualLandValue >= askingPrice,
    residualLandValue: Math.round(residualLandValue),
    modelledGfaSqm: Math.round(modelledGfaSqm),
    explicitDwellingCount,
    basis,
  };
}

export interface ClassificationEvidence {
  version: number;
  state: "NSW" | "QLD";
  planningEvidence: "council_machine" | "council_partial" | "manual_review" | "state_machine" | null;
  zoneFamily: NormalisedPlanningZone["family"];
  requiresCouncilVerification: boolean;
  tags: InvestmentTag[];
  deceasedEstate: DeceasedEstateProvenance;
  distressed: DistressedProvenance;
  dualIncome: {
    signalPresent: boolean;
    zoneCode: string | null;
    zonePass: boolean;
    landAreaSqm: number | null;
    minimumLandAreaSqm: 450;
    landAreaPass: boolean;
    qualifies: boolean;
  };
  developmentSite: {
    evidencePresent: boolean;
    zoneCode: string | null;
    zonePass: boolean;
    feasibility: ResidualLandValueAssessment;
    qualifies: boolean;
  };
  positiveGeared: NetCashFlowAssessment;
}

/**
 * Produce both the automatic tags and the exact gate outcomes stored by the
 * nightly sweep. This keeps catalogue labels and their provenance inseparable.
 */
export function buildClassificationEvidence(row: ClassifiableRow): ClassificationEvidence {
  const tags: InvestmentTag[] = [];
  const text = listingText(row);
  const deceasedEstate = assessDeceasedEstateProvenance(row);
  const distressed = assessDistressedProvenance(row);
  const positiveGeared = assessNetCashFlow(row);
  const zone = normalisePlanningZone(row.state, row.zoneCode);
  const zoneCode = zone.canonicalCode;
  const qldPlanningGate = zone.state !== "QLD" || row.planningEvidence === "council_machine";

  if (deceasedEstate.qualifies) tags.push("deceased_estate");

  const dualSignalPresent = DUAL_INCOME_RE.test(text);
  const dualZonePass = zone.residentialCandidate && qldPlanningGate;
  const dualLandAreaSqm = row.landAreaSqm ?? null;
  const dualLandAreaPass = dualLandAreaSqm != null && dualLandAreaSqm >= 450;
  const dualQualifies = dualSignalPresent && dualZonePass && dualLandAreaPass;
  if (dualQualifies) tags.push("dual_income");

  if (distressed.qualifies) tags.push("distressed");

  const developmentEvidencePresent = DEVELOPMENT_EVIDENCE_RE.test(text);
  const developmentZonePass = zone.developmentCandidate && qldPlanningGate;
  const feasibility = assessResidualLandValue(row);
  const developmentQualifies =
    developmentEvidencePresent && developmentZonePass && feasibility.qualifies;
  if (developmentQualifies) tags.push("dev_site");

  if (positiveGeared.qualifies) tags.push("pos_geared");

  return {
    version: CURRENT_CLASSIFIER_VERSION,
    state: zone.state,
    planningEvidence: row.planningEvidence ?? null,
    zoneFamily: zone.family,
    requiresCouncilVerification: zone.requiresCouncilVerification,
    tags,
    deceasedEstate,
    distressed,
    dualIncome: {
      signalPresent: dualSignalPresent,
      zoneCode,
      zonePass: dualZonePass,
      landAreaSqm: dualLandAreaSqm,
      minimumLandAreaSqm: 450,
      landAreaPass: dualLandAreaPass,
      qualifies: dualQualifies,
    },
    developmentSite: {
      evidencePresent: developmentEvidencePresent,
      zoneCode,
      zonePass: developmentZonePass,
      feasibility,
      qualifies: developmentQualifies,
    },
    positiveGeared,
  };
}

/** Returns all investment categories that pass their automatic gates. */
export function classifyListing(row: ClassifiableRow): InvestmentTag[] {
  return buildClassificationEvidence(row).tags;
}

export function tagsToString(tags: InvestmentTag[]): string {
  return tags.join("|");
}

export function parseTags(raw: string | null | undefined): InvestmentTag[] {
  if (!raw) return [];
  return raw.split("|").filter(Boolean) as InvestmentTag[];
}
