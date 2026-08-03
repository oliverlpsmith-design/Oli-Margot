import { describe, expect, it } from "vitest";
import { applyCatalogueStateDefaults } from "./catalogueStateDefaults";

const DEFAULT_FILTERS = {
  state: "all" as const,
  regionId: "all",
  zones: [] as string[],
  verdictFilter: "confirmed" as const,
  minLand: "100 acres",
  minPrice: "$800,000",
};

describe("applyCatalogueStateDefaults", () => {
  it("widens Queensland state selection to visible, unverified research rows", () => {
    const next = applyCatalogueStateDefaults({
      ...DEFAULT_FILTERS,
      regionId: "nsw-sydney",
      zones: ["R2"],
    }, "QLD");

    expect(next).toMatchObject({
      state: "QLD",
      regionId: "all",
      zones: [],
      verdictFilter: "all",
      minLand: "",
      minPrice: "$800,000",
    });
  });

  it("restores NSW verdict and land defaults when leaving a QLD research view", () => {
    const qld = applyCatalogueStateDefaults({
      ...DEFAULT_FILTERS,
      regionId: "nsw-sydney",
      zones: ["R2"],
    }, "QLD");
    const next = applyCatalogueStateDefaults(qld, "NSW");

    expect(next).toMatchObject({
      state: "NSW",
      regionId: "all",
      zones: [],
      verdictFilter: "confirmed",
      minLand: "100 acres",
    });
  });

  it("restores the combined catalogue defaults when leaving a QLD research view", () => {
    const qld = applyCatalogueStateDefaults(DEFAULT_FILTERS, "QLD");
    const next = applyCatalogueStateDefaults(qld, "all");

    expect(next).toMatchObject({
      state: "all",
      regionId: "all",
      zones: [],
      verdictFilter: "confirmed",
      minLand: "100 acres",
    });
  });
});
