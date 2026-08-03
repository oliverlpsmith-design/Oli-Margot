import { describe, expect, it } from "vitest";
import { NICHE_NAVIGATION } from "./nicheNavigation";
import { SUBDIVISION_CATEGORY } from "./subdivisionCategory";

describe("niche navigation", () => {
  it("includes the dedicated subdividable properties destination", () => {
    expect(NICHE_NAVIGATION).toContainEqual({
      href: "/niche/subdivision",
      label: "Subdividable Properties",
    });
  });

  it("keeps the subdivision page header metadata explicit", () => {
    expect(SUBDIVISION_CATEGORY).toMatchObject({
      badgeLabel: "Subdividable Properties",
      title: "Subdividable Land Investments",
    });
  });
});
