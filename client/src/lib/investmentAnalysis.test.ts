import { describe, expect, it } from "vitest";
import {
  buildDualIncomeScenario,
  buildRentalYieldScenario,
  calculateDiscountVsMedian,
  describeCampaignUrgency,
  estimateDevelopmentPotential,
} from "./investmentAnalysis";

describe("buildRentalYieldScenario", () => {
  it("uses the apartment gross-yield assumption and derives rent ratios", () => {
    const scenario = buildRentalYieldScenario(520_000, "Apartment");

    expect(scenario).not.toBeNull();
    expect(scenario?.assumedGrossYieldPct).toBe(5.5);
    expect(scenario?.estimatedAnnualRent).toBe(28_600);
    expect(scenario?.estimatedWeeklyRent).toBe(550);
    expect(scenario?.priceToRentRatio).toBeCloseTo(18.18, 2);
    expect(scenario?.estimatedMortgageWeekly).toBeGreaterThan(0);
    expect(scenario?.estimatedPreExpenseCashflowWeekly).toBe(
      scenario!.estimatedWeeklyRent - scenario!.estimatedMortgageWeekly,
    );
  });

  it("uses the house assumption and rejects missing or invalid prices", () => {
    expect(buildRentalYieldScenario(650_000, "House")?.assumedGrossYieldPct).toBe(4);
    expect(buildRentalYieldScenario(null, "House")).toBeNull();
    expect(buildRentalYieldScenario(-1, "House")).toBeNull();
    expect(buildRentalYieldScenario(Number.NaN, "House")).toBeNull();
  });
});

describe("buildDualIncomeScenario", () => {
  it("shows both dwelling rents, combined rent, and combined gross yield", () => {
    expect(buildDualIncomeScenario(650_000)).toEqual({
      estimatedMainDwellingRentWeekly: 500,
      estimatedSecondaryDwellingRentWeekly: 300,
      estimatedCombinedRentWeekly: 800,
      estimatedCombinedGrossYieldPct: 6.4,
    });
  });

  it("does not fabricate a scenario without a valid asking price", () => {
    expect(buildDualIncomeScenario(undefined)).toBeNull();
    expect(buildDualIncomeScenario(0)).toBeNull();
  });
});

describe("estimateDevelopmentPotential", () => {
  it("derives gross floor area and indicative dwelling capacity from site area and FSR", () => {
    expect(estimateDevelopmentPotential(1_200, 1.5)).toEqual({
      estimatedGrossFloorAreaSqm: 1_800,
      indicativeDwellingCapacity: 16,
      assumedGrossAreaPerDwellingSqm: 110,
    });
  });

  it("requires both valid stored inputs", () => {
    expect(estimateDevelopmentPotential(null, 1.5)).toBeNull();
    expect(estimateDevelopmentPotential(1_200, null)).toBeNull();
    expect(estimateDevelopmentPotential(1_200, 0)).toBeNull();
  });
});

describe("market context helpers", () => {
  it("calculates discounts and premiums against a comparison median", () => {
    expect(calculateDiscountVsMedian(800_000, 1_000_000)).toBe(20);
    expect(calculateDiscountVsMedian(1_200_000, 1_000_000)).toBe(-20);
    expect(calculateDiscountVsMedian(null, 1_000_000)).toBeNull();
  });

  it("classifies campaign timing at the documented boundaries", () => {
    expect(describeCampaignUrgency(null).label).toBe("Unknown");
    expect(describeCampaignUrgency(7).label).toBe("Fresh campaign");
    expect(describeCampaignUrgency(30).label).toBe("Active campaign");
    expect(describeCampaignUrgency(60).label).toBe("Extended campaign");
    expect(describeCampaignUrgency(61)).toMatchObject({ label: "Long campaign", tone: "urgent" });
  });
});
