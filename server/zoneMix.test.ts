import { describe, expect, it } from "vitest";
import { getZoneMix } from "./db";

describe("catalogue zoning mix", () => {
  it("returns top zone codes with counts and a total for the default confirmed view", async () => {
    const mix = await getZoneMix({ verdicts: ["subdividable", "marginal"] });
    expect(mix.total).toBeGreaterThan(0);
    expect(mix.zones.length).toBeGreaterThan(0);
    expect(mix.zones.length).toBeLessThanOrEqual(5);
    // Sorted descending by count
    for (let i = 1; i < mix.zones.length; i++) {
      expect(mix.zones[i - 1].count).toBeGreaterThanOrEqual(mix.zones[i].count);
    }
    // Every entry has a non-empty code and positive count
    for (const z of mix.zones) {
      expect(z.zoneCode).toBeTruthy();
      expect(z.count).toBeGreaterThan(0);
    }
    // Shown counts can never exceed the filtered total
    const shown = mix.zones.reduce((s, z) => s + z.count, 0);
    expect(shown).toBeLessThanOrEqual(mix.total);
  });

  it("respects the zones filter (mix restricted to selected codes)", async () => {
    const base = await getZoneMix({ verdicts: ["subdividable", "marginal"] });
    const target = base.zones[0]?.zoneCode;
    expect(target).toBeTruthy();
    const filtered = await getZoneMix({
      verdicts: ["subdividable", "marginal"],
      zones: [target!],
    });
    expect(filtered.zones.length).toBe(1);
    expect(filtered.zones[0].zoneCode).toBe(target);
    expect(filtered.total).toBe(filtered.zones[0].count);
  });

  it("respects other browse filters (e.g. minScore raises the bar)", async () => {
    const all = await getZoneMix({ verdicts: ["subdividable", "marginal"] });
    const strict = await getZoneMix({ verdicts: ["subdividable", "marginal"], minScore: 90 });
    expect(strict.total).toBeLessThanOrEqual(all.total);
  });
});
