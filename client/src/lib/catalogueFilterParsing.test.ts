import { describe, expect, it } from "vitest";
import {
  ACRE_TO_SQM,
  MAX_LAND_AREA_SQM,
  parseLandSizeFilter,
  parsePriceFilter,
} from "./catalogueFilterParsing";

describe("parsePriceFilter", () => {
  it("accepts formatted dollars and shorthand values", () => {
    expect(parsePriceFilter("$500,000")).toEqual({ value: 500_000, error: null });
    expect(parsePriceFilter("750k")).toEqual({ value: 750_000, error: null });
    expect(parsePriceFilter("1.2m")).toEqual({ value: 1_200_000, error: null });
  });

  it("treats blank and zero as no bound", () => {
    expect(parsePriceFilter("")).toEqual({ value: undefined, error: null });
    expect(parsePriceFilter("0")).toEqual({ value: undefined, error: null });
  });

  it("rejects invalid values", () => {
    expect(parsePriceFilter("lots").error).toBeTruthy();
    expect(parsePriceFilter("$1,500,000,000").error).toBeTruthy();
  });
});

describe("parseLandSizeFilter", () => {
  it("converts acres to square metres using the product conversion", () => {
    expect(parseLandSizeFilter("2 acres")).toEqual({ value: 2 * ACRE_TO_SQM, error: null });
    expect(parseLandSizeFilter("1.5 ac")).toEqual({ value: Math.round(1.5 * ACRE_TO_SQM), error: null });
  });

  it("accepts square metres and treats a bare number as sqm", () => {
    expect(parseLandSizeFilter("8,000 sqm")).toEqual({ value: 8_000, error: null });
    expect(parseLandSizeFilter("8000 m²")).toEqual({ value: 8_000, error: null });
    expect(parseLandSizeFilter("8000")).toEqual({ value: 8_000, error: null });
  });

  it("accepts exactly 500 acres and rejects larger values", () => {
    expect(parseLandSizeFilter("500 acres")).toEqual({ value: MAX_LAND_AREA_SQM, error: null });
    expect(parseLandSizeFilter("500.1 acres").error).toContain("500 acres");
    expect(parseLandSizeFilter(`${MAX_LAND_AREA_SQM + 1} sqm`).error).toContain("500 acres");
  });

  it("rejects ambiguous or malformed values", () => {
    expect(parseLandSizeFilter("2 acres 8000 sqm").error).toBeTruthy();
    expect(parseLandSizeFilter("large block").error).toBeTruthy();
  });
});
