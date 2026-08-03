export interface RentalYieldScenario {
  assumedGrossYieldPct: number;
  estimatedWeeklyRent: number;
  estimatedAnnualRent: number;
  priceToRentRatio: number;
  estimatedMortgageWeekly: number;
  estimatedPreExpenseCashflowWeekly: number;
}

export interface DualIncomeScenario {
  estimatedMainDwellingRentWeekly: number;
  estimatedSecondaryDwellingRentWeekly: number;
  estimatedCombinedRentWeekly: number;
  estimatedCombinedGrossYieldPct: number;
}

export interface DevelopmentPotential {
  estimatedGrossFloorAreaSqm: number;
  indicativeDwellingCapacity: number;
  assumedGrossAreaPerDwellingSqm: number;
}

/**
 * Creates a transparent gross-yield scenario from the stored asking price and
 * property type. This is not a rental appraisal and never represents sourced
 * market rent data.
 */
export function buildRentalYieldScenario(
  askingPrice: number | null | undefined,
  propertyType: string | null | undefined,
): RentalYieldScenario | null {
  if (!askingPrice || !Number.isFinite(askingPrice) || askingPrice <= 0) return null;

  const type = propertyType?.toLowerCase() ?? "";
  const assumedGrossYieldPct =
    type.includes("unit") || type.includes("apartment") || type.includes("studio")
      ? 5.5
      : type.includes("house") || type.includes("acreage")
        ? 4
        : 4.5;
  const estimatedAnnualRent = Math.round(askingPrice * (assumedGrossYieldPct / 100));
  const estimatedWeeklyRent = Math.round(estimatedAnnualRent / 52);
  const priceToRentRatio = askingPrice / estimatedAnnualRent;

  const loanAmount = askingPrice * 0.8;
  const weeklyInterestRate = 0.065 / 52;
  const paymentCount = 52 * 30;
  const estimatedMortgageWeekly = Math.round(
    (loanAmount * weeklyInterestRate) /
      (1 - Math.pow(1 + weeklyInterestRate, -paymentCount)),
  );

  return {
    assumedGrossYieldPct,
    estimatedWeeklyRent,
    estimatedAnnualRent,
    priceToRentRatio,
    estimatedMortgageWeekly,
    estimatedPreExpenseCashflowWeekly: estimatedWeeklyRent - estimatedMortgageWeekly,
  };
}

/**
 * Models a two-dwelling income scenario from the stored asking price. The main
 * dwelling uses a 4% gross-yield scenario and the secondary dwelling is set at
 * 60% of the main-dwelling rent. Both assumptions are surfaced in the UI.
 */
export function buildDualIncomeScenario(
  askingPrice: number | null | undefined,
): DualIncomeScenario | null {
  if (!askingPrice || !Number.isFinite(askingPrice) || askingPrice <= 0) return null;

  const estimatedMainDwellingRentWeekly = Math.round((askingPrice * 0.04) / 52);
  const estimatedSecondaryDwellingRentWeekly = Math.round(estimatedMainDwellingRentWeekly * 0.6);
  const estimatedCombinedRentWeekly =
    estimatedMainDwellingRentWeekly + estimatedSecondaryDwellingRentWeekly;

  return {
    estimatedMainDwellingRentWeekly,
    estimatedSecondaryDwellingRentWeekly,
    estimatedCombinedRentWeekly,
    estimatedCombinedGrossYieldPct:
      ((estimatedCombinedRentWeekly * 52) / askingPrice) * 100,
  };
}

/**
 * Converts stored site area and FSR into an indicative concept capacity using
 * 110 m² of gross floor area per dwelling. It is a screening metric, not a DA
 * feasibility study.
 */
export function estimateDevelopmentPotential(
  siteAreaSqm: number | null | undefined,
  fsr: number | null | undefined,
): DevelopmentPotential | null {
  if (!siteAreaSqm || !Number.isFinite(siteAreaSqm) || siteAreaSqm <= 0) return null;
  if (!fsr || !Number.isFinite(fsr) || fsr <= 0) return null;

  const assumedGrossAreaPerDwellingSqm = 110;
  const estimatedGrossFloorAreaSqm = siteAreaSqm * fsr;
  return {
    estimatedGrossFloorAreaSqm,
    indicativeDwellingCapacity: Math.max(
      0,
      Math.floor(estimatedGrossFloorAreaSqm / assumedGrossAreaPerDwellingSqm),
    ),
    assumedGrossAreaPerDwellingSqm,
  };
}

export function calculateDiscountVsMedian(
  askingPrice: number | null | undefined,
  medianPrice: number | null | undefined,
): number | null {
  if (!askingPrice || !medianPrice || askingPrice <= 0 || medianPrice <= 0) return null;
  return ((medianPrice - askingPrice) / medianPrice) * 100;
}

export function describeCampaignUrgency(daysOnMarket: number | null): {
  label: string;
  detail: string;
  tone: "neutral" | "watch" | "urgent";
} {
  if (daysOnMarket === null) {
    return {
      label: "Unknown",
      detail: "Listing dates are unavailable, so campaign urgency cannot be inferred.",
      tone: "neutral",
    };
  }
  if (daysOnMarket <= 7) {
    return {
      label: "Fresh campaign",
      detail: "Newly listed; any mortgagee or estate wording is the stronger urgency signal.",
      tone: "neutral",
    };
  }
  if (daysOnMarket <= 30) {
    return {
      label: "Active campaign",
      detail: "Still within a typical first-month campaign window.",
      tone: "watch",
    };
  }
  if (daysOnMarket <= 60) {
    return {
      label: "Extended campaign",
      detail: "Over 30 days on market; confirm vendor expectations and recent agent feedback.",
      tone: "watch",
    };
  }
  return {
    label: "Long campaign",
    detail: "Over 60 days on market; investigate price expectations, condition, and contract terms.",
    tone: "urgent",
  };
}
