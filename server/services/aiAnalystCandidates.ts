import { createHash } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { catalogueListings } from "../../drizzle/schema";
import { getDb } from "../db";

export const ANALYST_PRIMARY_MODEL = "gpt-5-mini";
export const ANALYST_FALLBACK_MODEL = "gpt-5";
export const PICKS_PER_PERSONA = 3;
export const CANDIDATES_PER_PERSONA = 12;

export type AnalystPersonaKey =
  | "subdivider"
  | "cash_flow_hunter"
  | "value_finder";

export type EvidenceConfidenceLabel = "low" | "moderate" | "high";

export interface AnalystPersonaDefinition {
  key: AnalystPersonaKey;
  name: string;
  hypotheticalBudget: number;
  strategy: string;
  accent: "emerald" | "blue" | "amber";
}

export const ANALYST_PERSONAS: Record<AnalystPersonaKey, AnalystPersonaDefinition> = {
  subdivider: {
    key: "subdivider",
    name: "The Subdivider",
    hypotheticalBudget: 1_500_000,
    strategy:
      "Screens for theoretical subdivision capacity, confirmed planning evidence, practical site signals and fewer mapped constraints.",
    accent: "emerald",
  },
  cash_flow_hunter: {
    key: "cash_flow_hunter",
    name: "The Cash Flow Hunter",
    hypotheticalBudget: 800_000,
    strategy:
      "Compares all dwelling types using a disclosed cash-flow scenario. It does not represent a rental appraisal or verified positive gearing.",
    accent: "blue",
  },
  value_finder: {
    key: "value_finder",
    name: "The Value Finder",
    hypotheticalBudget: 1_200_000,
    strategy:
      "Screens estate, distressed and development campaigns for discount to comparable active asking prices and evidence-backed upside.",
    accent: "amber",
  },
};

export interface AnalystSourceRow {
  id: number;
  listingId: string;
  address: string | null;
  suburb: string | null;
  postcode: string | null;
  regionId: string | null;
  propertyType: string | null;
  priceDisplay: string | null;
  priceNumeric: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  landAreaSqm: string | null;
  minLotSizeSqm: string | null;
  zoneCode: string | null;
  lgaName: string | null;
  potentialLots: number | null;
  verdict: "subdividable" | "marginal" | "not_subdividable" | "unknown";
  existingScore: number;
  coveragePct: string | null;
  frontageM: string | null;
  isNewBuild: boolean;
  investmentTags: string;
  headline: string | null;
  descriptionShort: string | null;
  acidSulfateClass: string | null;
  fsrValue: string | null;
  maxBuildingHeightM: string | null;
  bushfireCategory: string | null;
  floodRisk: string | null;
  heritageFlag: string | null;
  biodiversityFlag: string | null;
  listedAt: Date | null;
  firstSeenAt: Date;
  updatedAt: Date;
}

export interface ScoreComponent {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface ComparableBenchmark {
  medianAskingPrice: number;
  sampleSize: number;
  scope: "suburb_property_bedrooms" | "suburb_property" | "suburb";
  discountPct: number;
}

export interface CashFlowScenario {
  label: "scenario_based";
  rentEvidence: "advertised_unverified" | "property_type_assumption";
  assumedGrossYieldPct: number;
  estimatedWeeklyRent: number;
  annualGrossRent: number;
  loanToValuePct: number;
  interestRatePct: number;
  loanTermYears: number;
  annualDebtService: number;
  managementPctOfRent: number;
  vacancyPctOfRent: number;
  maintenancePctOfPrice: number;
  annualCouncilRates: number;
  annualInsurance: number;
  annualStrata: number;
  annualOperatingExpenses: number;
  annualNetCashflow: number;
  weeklyNetCashflow: number;
  netCashflowPctOfPrice: number;
}

export interface AnalystCandidate {
  personaKey: AnalystPersonaKey;
  catalogueListingId: number;
  listingId: string;
  hypotheticalBudget: number;
  deterministicScore: number;
  evidenceConfidence: number;
  confidenceLabel: EvidenceConfidenceLabel;
  inputFingerprint: string;
  scoreComponents: ScoreComponent[];
  riskFlags: string[];
  unknowns: string[];
  comparableBenchmark: ComparableBenchmark | null;
  cashFlowScenario: CashFlowScenario | null;
  facts: {
    address: string | null;
    suburb: string | null;
    postcode: string | null;
    propertyType: string | null;
    priceDisplay: string | null;
    priceNumeric: number;
    bedrooms: number | null;
    bathrooms: number | null;
    landAreaSqm: number | null;
    minLotSizeSqm: number | null;
    zoneCode: string | null;
    lgaName: string | null;
    potentialLots: number | null;
    verdict: AnalystSourceRow["verdict"];
    frontageM: number | null;
    coveragePct: number | null;
    fsrValue: number | null;
    maxBuildingHeightM: number | null;
    investmentTags: string[];
    headline: string | null;
    descriptionShort: string | null;
    daysOnMarket: number;
  };
}

const SOURCE_SELECTION = {
  id: catalogueListings.id,
  listingId: catalogueListings.listingId,
  address: catalogueListings.address,
  suburb: catalogueListings.suburb,
  postcode: catalogueListings.postcode,
  regionId: catalogueListings.regionId,
  propertyType: catalogueListings.propertyType,
  priceDisplay: catalogueListings.priceDisplay,
  priceNumeric: catalogueListings.priceNumeric,
  bedrooms: catalogueListings.bedrooms,
  bathrooms: catalogueListings.bathrooms,
  landAreaSqm: catalogueListings.landAreaSqm,
  minLotSizeSqm: catalogueListings.minLotSizeSqm,
  zoneCode: catalogueListings.zoneCode,
  lgaName: catalogueListings.lgaName,
  potentialLots: catalogueListings.potentialLots,
  verdict: catalogueListings.verdict,
  existingScore: catalogueListings.score,
  coveragePct: catalogueListings.coveragePct,
  frontageM: catalogueListings.frontageM,
  isNewBuild: catalogueListings.isNewBuild,
  investmentTags: catalogueListings.investmentTags,
  headline: catalogueListings.headline,
  descriptionShort: catalogueListings.descriptionShort,
  acidSulfateClass: catalogueListings.acidSulfateClass,
  fsrValue: catalogueListings.fsrValue,
  maxBuildingHeightM: catalogueListings.maxBuildingHeightM,
  bushfireCategory: catalogueListings.bushfireCategory,
  floodRisk: catalogueListings.floodRisk,
  heritageFlag: catalogueListings.heritageFlag,
  biodiversityFlag: catalogueListings.biodiversityFlag,
  listedAt: catalogueListings.listedAt,
  firstSeenAt: catalogueListings.firstSeenAt,
  updatedAt: catalogueListings.updatedAt,
};

export async function loadAnalystSourceRows(): Promise<AnalystSourceRow[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select(SOURCE_SELECTION)
    .from(catalogueListings)
    .where(
      and(
        eq(catalogueListings.status, "active"),
        isNotNull(catalogueListings.priceNumeric),
      ),
    ) as Promise<AnalystSourceRow[]>;
}

function finiteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, precision = 0): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function daysOnMarket(row: AnalystSourceRow, now: Date): number {
  const since = row.listedAt ?? row.firstSeenAt;
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000));
}

function recencyPoints(days: number): number {
  if (days <= 7) return 10;
  if (days <= 14) return 7;
  if (days <= 30) return 4;
  if (days <= 60) return 2;
  return 0;
}

function parseTags(raw: string): string[] {
  return raw.split("|").filter(Boolean);
}

function hasTag(row: AnalystSourceRow, tag: string): boolean {
  return parseTags(row.investmentTags).includes(tag);
}

function riskFlags(row: AnalystSourceRow): string[] {
  const flags: string[] = [];
  if (row.bushfireCategory) flags.push(`Bushfire: ${row.bushfireCategory}`);
  if (row.floodRisk) flags.push("Mapped flood planning flag");
  if (row.heritageFlag) flags.push(`Heritage: ${row.heritageFlag}`);
  if (row.biodiversityFlag) flags.push("Biodiversity Values Map flag");
  if (row.acidSulfateClass) flags.push(`Acid sulfate soils: ${row.acidSulfateClass}`);
  return flags;
}

function confidenceLabel(score: number): EvidenceConfidenceLabel {
  if (score >= 75) return "high";
  if (score >= 50) return "moderate";
  return "low";
}

function normalisePropertyType(value: string | null): string {
  const type = value?.toLowerCase() ?? "unknown";
  if (/unit|apartment|studio/.test(type)) return "unit";
  if (/house|townhouse|villa|terrace|duplex|semi/.test(type)) return "house";
  if (/acreage|rural|lifestyle|farm|cropping|livestock|horticulture/.test(type)) {
    return "rural";
  }
  if (/land/.test(type)) return "land";
  return type || "unknown";
}

function bedroomBand(bedrooms: number | null): string {
  if (bedrooms === null) return "unknown";
  if (bedrooms <= 1) return "0-1";
  if (bedrooms >= 4) return "4+";
  return String(bedrooms);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

interface ComparableIndex {
  exact: Map<string, number[]>;
  property: Map<string, number[]>;
  suburb: Map<string, number[]>;
}

function appendComparable(map: Map<string, number[]>, key: string, price: number): void {
  const values = map.get(key);
  if (values) values.push(price);
  else map.set(key, [price]);
}

function comparableKeys(row: AnalystSourceRow) {
  const place = `${row.suburb?.trim().toLowerCase() ?? ""}|${row.postcode ?? ""}`;
  const property = normalisePropertyType(row.propertyType);
  return {
    exact: `${place}|${property}|${bedroomBand(row.bedrooms)}`,
    property: `${place}|${property}`,
    suburb: place,
  };
}

function buildComparableIndex(rows: AnalystSourceRow[]): ComparableIndex {
  const index: ComparableIndex = {
    exact: new Map(),
    property: new Map(),
    suburb: new Map(),
  };

  for (const row of rows) {
    const price = finiteNumber(row.priceNumeric);
    if (!price || !row.suburb) continue;
    const keys = comparableKeys(row);
    appendComparable(index.exact, keys.exact, price);
    appendComparable(index.property, keys.property, price);
    appendComparable(index.suburb, keys.suburb, price);
  }
  return index;
}

function comparableBenchmark(
  row: AnalystSourceRow,
  index: ComparableIndex,
): ComparableBenchmark | null {
  const price = finiteNumber(row.priceNumeric);
  if (!price || !row.suburb) return null;
  const keys = comparableKeys(row);
  const options: Array<{
    values: number[] | undefined;
    minimum: number;
    scope: ComparableBenchmark["scope"];
  }> = [
    { values: index.exact.get(keys.exact), minimum: 5, scope: "suburb_property_bedrooms" },
    { values: index.property.get(keys.property), minimum: 5, scope: "suburb_property" },
    { values: index.suburb.get(keys.suburb), minimum: 8, scope: "suburb" },
  ];

  for (const option of options) {
    if (!option.values || option.values.length < option.minimum) continue;
    const askingMedian = median(option.values);
    if (!askingMedian) continue;
    return {
      medianAskingPrice: Math.round(askingMedian),
      sampleSize: option.values.length,
      scope: option.scope,
      discountPct: round(((askingMedian - price) / askingMedian) * 100, 1),
    };
  }
  return null;
}

export function parseAdvertisedWeeklyRent(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, " ").replace(/\s+/g, " ");
  const patterns = [
    /(?:rent|rental|return|income|leased|tenanted)[^$\d]{0,30}\$?\s*(\d{2,4})\s*(?:per\s*week|p\/?w|weekly)/i,
    /\$\s*(\d{2,4})\s*(?:per\s*week|p\/?w|weekly)/i,
  ];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (!match) continue;
    const amount = Number(match[1]);
    if (Number.isFinite(amount) && amount >= 80 && amount <= 5_000) return amount;
  }
  return null;
}

export function buildCashFlowScenario(row: AnalystSourceRow): CashFlowScenario | null {
  const price = finiteNumber(row.priceNumeric);
  if (!price || price <= 0) return null;

  const advertisedWeeklyRent = parseAdvertisedWeeklyRent(
    `${row.headline ?? ""} ${row.descriptionShort ?? ""}`,
  );
  const propertyType = normalisePropertyType(row.propertyType);
  const assumedGrossYieldPct = advertisedWeeklyRent
    ? (advertisedWeeklyRent * 52 * 100) / price
    : propertyType === "unit"
      ? 5.5
      : propertyType === "house" || propertyType === "rural"
        ? 4
        : 4.5;
  const estimatedWeeklyRent = advertisedWeeklyRent ?? Math.round((price * assumedGrossYieldPct) / 100 / 52);
  const annualGrossRent = estimatedWeeklyRent * 52;
  const loanToValuePct = 80;
  const interestRatePct = 6.5;
  const loanTermYears = 30;
  const principal = price * (loanToValuePct / 100);
  const monthlyRate = interestRatePct / 100 / 12;
  const payments = loanTermYears * 12;
  const monthlyPayment =
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -payments));
  const annualDebtService = monthlyPayment * 12;
  const managementPctOfRent = 7;
  const vacancyPctOfRent = 3;
  const maintenancePctOfPrice = 0.75;
  const annualCouncilRates = 2_000;
  const annualInsurance = 1_500;
  const annualStrata = propertyType === "unit" ? 4_000 : 0;
  const annualOperatingExpenses =
    annualGrossRent * ((managementPctOfRent + vacancyPctOfRent) / 100) +
    price * (maintenancePctOfPrice / 100) +
    annualCouncilRates +
    annualInsurance +
    annualStrata;
  const annualNetCashflow = annualGrossRent - annualOperatingExpenses - annualDebtService;

  return {
    label: "scenario_based",
    rentEvidence: advertisedWeeklyRent ? "advertised_unverified" : "property_type_assumption",
    assumedGrossYieldPct: round((annualGrossRent / price) * 100, 2),
    estimatedWeeklyRent: Math.round(estimatedWeeklyRent),
    annualGrossRent: Math.round(annualGrossRent),
    loanToValuePct,
    interestRatePct,
    loanTermYears,
    annualDebtService: Math.round(annualDebtService),
    managementPctOfRent,
    vacancyPctOfRent,
    maintenancePctOfPrice,
    annualCouncilRates,
    annualInsurance,
    annualStrata,
    annualOperatingExpenses: Math.round(annualOperatingExpenses),
    annualNetCashflow: Math.round(annualNetCashflow),
    weeklyNetCashflow: Math.round(annualNetCashflow / 52),
    netCashflowPctOfPrice: round((annualNetCashflow / price) * 100, 2),
  };
}

function candidateFacts(row: AnalystSourceRow, now: Date): AnalystCandidate["facts"] {
  const price = finiteNumber(row.priceNumeric);
  if (!price) throw new Error(`Listing ${row.listingId} has no numeric price`);
  return {
    address: row.address,
    suburb: row.suburb,
    postcode: row.postcode,
    propertyType: row.propertyType,
    priceDisplay: row.priceDisplay,
    priceNumeric: price,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    landAreaSqm: finiteNumber(row.landAreaSqm),
    minLotSizeSqm: finiteNumber(row.minLotSizeSqm),
    zoneCode: row.zoneCode,
    lgaName: row.lgaName,
    potentialLots: row.potentialLots,
    verdict: row.verdict,
    frontageM: finiteNumber(row.frontageM),
    coveragePct: finiteNumber(row.coveragePct),
    fsrValue: finiteNumber(row.fsrValue),
    maxBuildingHeightM: finiteNumber(row.maxBuildingHeightM),
    investmentTags: parseTags(row.investmentTags),
    headline: row.headline,
    descriptionShort: row.descriptionShort,
    daysOnMarket: daysOnMarket(row, now),
  };
}

function fingerprint(candidate: Omit<AnalystCandidate, "inputFingerprint">): string {
  const { daysOnMarket: _daysOnMarket, ...materialFacts } = candidate.facts;
  const payload = {
    version: 1,
    personaKey: candidate.personaKey,
    deterministicScore: candidate.deterministicScore,
    evidenceConfidence: candidate.evidenceConfidence,
    scoreComponents: candidate.scoreComponents.map(component => ({
      key: component.key,
      points: component.points,
      maxPoints: component.maxPoints,
    })),
    riskFlags: candidate.riskFlags,
    unknowns: candidate.unknowns,
    comparableBenchmark: candidate.comparableBenchmark,
    cashFlowScenario: candidate.cashFlowScenario,
    facts: materialFacts,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function finaliseCandidate(
  candidate: Omit<AnalystCandidate, "inputFingerprint">,
): AnalystCandidate {
  return { ...candidate, inputFingerprint: fingerprint(candidate) };
}

function buildSubdividerCandidate(
  row: AnalystSourceRow,
  now: Date,
): AnalystCandidate | null {
  const persona = ANALYST_PERSONAS.subdivider;
  const price = finiteNumber(row.priceNumeric);
  const land = finiteNumber(row.landAreaSqm);
  const minLot = finiteNumber(row.minLotSizeSqm);
  if (
    !price ||
    price > persona.hypotheticalBudget ||
    !land ||
    !minLot ||
    !row.zoneCode ||
    !row.potentialLots ||
    row.potentialLots < 2 ||
    !["subdividable", "marginal"].includes(row.verdict) ||
    row.isNewBuild
  ) {
    return null;
  }

  const days = daysOnMarket(row, now);
  const frontage = finiteNumber(row.frontageM);
  const coverage = finiteNumber(row.coveragePct);
  const risks = riskFlags(row);
  const lotYieldPoints = clamp(15 + (row.potentialLots - 2) * 7, 15, 35);
  const verdictPoints = row.verdict === "subdividable" ? 20 : 12;
  const frontagePoints = frontage === null ? 0 : frontage >= 20 ? 12 : frontage >= 15 ? 9 : frontage >= 10 ? 5 : 2;
  const riskPoints = clamp(15 - risks.length * 4, 0, 15);
  const coveragePoints = coverage === null ? 0 : coverage <= 25 ? 8 : coverage <= 40 ? 5 : coverage <= 55 ? 2 : 0;
  const freshnessPoints = recencyPoints(days);
  const scoreComponents: ScoreComponent[] = [
    { key: "lot_yield", label: "Theoretical lot yield", points: lotYieldPoints, maxPoints: 35, detail: `${row.potentialLots} theoretical lots from stored area and minimum-lot-size data.` },
    { key: "planning_verdict", label: "Planning screen", points: verdictPoints, maxPoints: 20, detail: `Current catalogue verdict: ${row.verdict}.` },
    { key: "frontage", label: "Frontage evidence", points: frontagePoints, maxPoints: 12, detail: frontage === null ? "Frontage is not stated in stored listing evidence." : `${frontage} m frontage parsed from listing copy.` },
    { key: "mapped_risk", label: "Mapped constraints", points: riskPoints, maxPoints: 15, detail: risks.length ? `${risks.length} mapped risk flag(s) reduce the screen.` : "No stored mapped risk flags were returned; independent checks remain required." },
    { key: "site_coverage", label: "Site coverage", points: coveragePoints, maxPoints: 8, detail: coverage === null ? "Dwelling coverage is unknown." : `${coverage}% indicative dwelling-to-site coverage.` },
    { key: "freshness", label: "Listing freshness", points: freshnessPoints, maxPoints: 10, detail: `${days} day(s) on market from stored listing dates.` },
  ];
  const confidence = clamp(
    35 +
      (row.zoneCode ? 10 : 0) +
      (minLot ? 15 : 0) +
      (land ? 10 : 0) +
      (frontage !== null ? 12 : 0) +
      (coverage !== null ? 8 : 0) +
      (row.descriptionShort ? 5 : 0),
    0,
    95,
  );
  const unknowns = [
    ...(frontage === null ? ["Frontage is unknown"] : []),
    ...(coverage === null ? ["Dwelling footprint coverage is unknown"] : []),
    ...(row.fsrValue === null ? ["FSR is not mapped in stored evidence"] : []),
    ...(row.maxBuildingHeightM === null ? ["Maximum building height is not mapped in stored evidence"] : []),
    "Services, easements, title restrictions, slope, access and council interpretation require independent verification",
  ];
  const withoutFingerprint: Omit<AnalystCandidate, "inputFingerprint"> = {
    personaKey: persona.key,
    catalogueListingId: row.id,
    listingId: row.listingId,
    hypotheticalBudget: persona.hypotheticalBudget,
    deterministicScore: scoreComponents.reduce((sum, item) => sum + item.points, 0),
    evidenceConfidence: confidence,
    confidenceLabel: confidenceLabel(confidence),
    scoreComponents,
    riskFlags: risks,
    unknowns,
    comparableBenchmark: null,
    cashFlowScenario: null,
    facts: candidateFacts(row, now),
  };
  return finaliseCandidate(withoutFingerprint);
}

function buildCashFlowCandidate(
  row: AnalystSourceRow,
  now: Date,
): AnalystCandidate | null {
  const persona = ANALYST_PERSONAS.cash_flow_hunter;
  const price = finiteNumber(row.priceNumeric);
  const propertyType = normalisePropertyType(row.propertyType);
  if (
    !price ||
    price > persona.hypotheticalBudget ||
    !row.bedrooms ||
    row.bedrooms < 1 ||
    propertyType === "land"
  ) {
    return null;
  }
  const scenario = buildCashFlowScenario(row);
  if (!scenario) return null;
  const days = daysOnMarket(row, now);
  const pricePerBedroom = price / row.bedrooms;
  const cashflowPoints = clamp(Math.round(45 + scenario.netCashflowPctOfPrice * 7.5), 0, 60);
  const efficiencyPoints = pricePerBedroom <= 180_000 ? 15 : pricePerBedroom <= 230_000 ? 12 : pricePerBedroom <= 300_000 ? 8 : pricePerBedroom <= 400_000 ? 4 : 0;
  const evidencePoints =
    (scenario.rentEvidence === "advertised_unverified" ? 10 : 0) +
    (hasTag(row, "dual_income") ? 3 : 0) +
    (hasTag(row, "pos_geared") ? 2 : 0);
  const freshnessPoints = recencyPoints(days);
  const scoreComponents: ScoreComponent[] = [
    { key: "scenario_cashflow", label: "Scenario cash flow", points: cashflowPoints, maxPoints: 60, detail: `${scenario.weeklyNetCashflow >= 0 ? "+" : ""}$${scenario.weeklyNetCashflow.toLocaleString()} per week after disclosed assumed costs and debt service.` },
    { key: "price_bed_efficiency", label: "Price per bedroom", points: efficiencyPoints, maxPoints: 15, detail: `$${Math.round(pricePerBedroom).toLocaleString()} per bedroom.` },
    { key: "income_evidence", label: "Income evidence", points: evidencePoints, maxPoints: 15, detail: scenario.rentEvidence === "advertised_unverified" ? "Listing copy contains an advertised weekly rent; it is not independently verified." : "Rent is inferred solely from a property-type gross-yield assumption." },
    { key: "freshness", label: "Listing freshness", points: freshnessPoints, maxPoints: 10, detail: `${days} day(s) on market from stored listing dates.` },
  ];
  const confidence = clamp(
    25 +
      (row.propertyType ? 8 : 0) +
      (row.bedrooms ? 7 : 0) +
      (row.descriptionShort ? 5 : 0) +
      (scenario.rentEvidence === "advertised_unverified" ? 10 : 0),
    0,
    55,
  );
  const unknowns = [
    ...(scenario.rentEvidence === "property_type_assumption" ? ["No sourced rental appraisal or advertised weekly rent"] : ["Advertised rent has not been independently verified"]),
    "No verified suburb vacancy-rate or rental-demand feed",
    "No property-specific rates, insurance, management, maintenance, strata or finance quote",
    "Tax, depreciation, acquisition costs and personal borrowing circumstances are excluded",
  ];
  const withoutFingerprint: Omit<AnalystCandidate, "inputFingerprint"> = {
    personaKey: persona.key,
    catalogueListingId: row.id,
    listingId: row.listingId,
    hypotheticalBudget: persona.hypotheticalBudget,
    deterministicScore: scoreComponents.reduce((sum, item) => sum + item.points, 0),
    evidenceConfidence: confidence,
    confidenceLabel: confidenceLabel(confidence),
    scoreComponents,
    riskFlags: riskFlags(row),
    unknowns,
    comparableBenchmark: null,
    cashFlowScenario: scenario,
    facts: candidateFacts(row, now),
  };
  return finaliseCandidate(withoutFingerprint);
}

function buildValueCandidate(
  row: AnalystSourceRow,
  index: ComparableIndex,
  now: Date,
): AnalystCandidate | null {
  const persona = ANALYST_PERSONAS.value_finder;
  const price = finiteNumber(row.priceNumeric);
  const relevantTags = ["deceased_estate", "distressed", "dev_site"].filter(tag => hasTag(row, tag));
  if (!price || price > persona.hypotheticalBudget || relevantTags.length === 0) return null;

  const benchmark = comparableBenchmark(row, index);
  const days = daysOnMarket(row, now);
  const discountPoints = benchmark
    ? clamp(Math.round(Math.max(0, benchmark.discountPct) * 2), 0, 40)
    : 0;
  const campaignPoints =
    (relevantTags.includes("distressed") ? 12 : 0) +
    (relevantTags.includes("deceased_estate") ? 8 : 0);
  const upsidePoints =
    (relevantTags.includes("dev_site") ? 10 : 0) +
    (row.fsrValue !== null ? 4 : 0) +
    (row.potentialLots && row.potentialLots >= 2 ? 4 : 0) +
    (row.zoneCode ? 2 : 0);
  const freshnessPoints = recencyPoints(days);
  const scoreComponents: ScoreComponent[] = [
    { key: "asking_discount", label: "Active asking-price discount", points: discountPoints, maxPoints: 40, detail: benchmark ? `${benchmark.discountPct}% versus a $${benchmark.medianAskingPrice.toLocaleString()} comparable active asking median (${benchmark.sampleSize} listings).` : "No sufficiently populated active asking-price comparison group." },
    { key: "campaign_signal", label: "Campaign evidence", points: campaignPoints, maxPoints: 20, detail: `Stored listing-language tags: ${relevantTags.join(", ")}. These are screening signals, not proof of seller motivation or value.` },
    { key: "planning_upside", label: "Planning upside evidence", points: upsidePoints, maxPoints: 20, detail: relevantTags.includes("dev_site") ? "Development-language evidence is present; approvals and feasibility remain unverified." : "No development-site language tag is present." },
    { key: "freshness", label: "Listing freshness", points: freshnessPoints, maxPoints: 10, detail: `${days} day(s) on market from stored listing dates.` },
    { key: "evidence_breadth", label: "Evidence breadth", points: clamp(relevantTags.length * 5, 5, 10), maxPoints: 10, detail: `${relevantTags.length} relevant campaign or upside signal(s).` },
  ];
  const confidence = clamp(
    25 +
      (benchmark ? Math.min(25, 10 + benchmark.sampleSize) : 0) +
      (row.descriptionShort ? 15 : 0) +
      (row.zoneCode ? 8 : 0) +
      (row.fsrValue !== null || row.potentialLots ? 7 : 0),
    0,
    85,
  );
  const unknowns = [
    ...(benchmark ? ["Comparable benchmark uses active asking prices, not settled sales or a formal valuation"] : ["No sufficiently populated comparable active asking-price group"]),
    "Property condition, contract terms, vendor circumstances and renovation costs are unverified",
    ...(relevantTags.includes("dev_site") ? ["Development approval status, infrastructure, servicing and residual value require independent feasibility"] : []),
  ];
  const withoutFingerprint: Omit<AnalystCandidate, "inputFingerprint"> = {
    personaKey: persona.key,
    catalogueListingId: row.id,
    listingId: row.listingId,
    hypotheticalBudget: persona.hypotheticalBudget,
    deterministicScore: scoreComponents.reduce((sum, item) => sum + item.points, 0),
    evidenceConfidence: confidence,
    confidenceLabel: confidenceLabel(confidence),
    scoreComponents,
    riskFlags: riskFlags(row),
    unknowns,
    comparableBenchmark: benchmark,
    cashFlowScenario: null,
    facts: candidateFacts(row, now),
  };
  return finaliseCandidate(withoutFingerprint);
}

function rankCandidates(candidates: Array<AnalystCandidate | null>): AnalystCandidate[] {
  return candidates
    .filter((candidate): candidate is AnalystCandidate => candidate !== null)
    .sort((a, b) =>
      b.deterministicScore - a.deterministicScore ||
      b.evidenceConfidence - a.evidenceConfidence ||
      a.facts.daysOnMarket - b.facts.daysOnMarket ||
      a.catalogueListingId - b.catalogueListingId,
    )
    .slice(0, CANDIDATES_PER_PERSONA);
}

export function buildPersonaCandidateSets(
  rows: AnalystSourceRow[],
  now = new Date(),
): Record<AnalystPersonaKey, AnalystCandidate[]> {
  const index = buildComparableIndex(rows);
  return {
    subdivider: rankCandidates(rows.map(row => buildSubdividerCandidate(row, now))),
    cash_flow_hunter: rankCandidates(rows.map(row => buildCashFlowCandidate(row, now))),
    value_finder: rankCandidates(rows.map(row => buildValueCandidate(row, index, now))),
  };
}
