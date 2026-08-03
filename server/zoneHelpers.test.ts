import { describe, expect, it } from "vitest";
import { zoneFamily, zoneChipClasses, ZONE_PRESETS } from "../client/src/lib/zones";

describe("zone family classification", () => {
  it("classifies residential codes", () => {
    for (const z of ["R1", "R2", "R3", "R4", "R5"]) {
      expect(zoneFamily(z)).toBe("residential");
    }
  });

  it("classifies rural codes (RU takes precedence over R)", () => {
    for (const z of ["RU1", "RU2", "RU4", "RU5", "RU6"]) {
      expect(zoneFamily(z)).toBe("rural");
    }
  });

  it("classifies current conservation codes", () => {
    for (const z of ["C1", "C2", "C3", "C4"]) {
      expect(zoneFamily(z)).toBe("environmental");
    }
  });

  it("classifies current E1–E5 employment and MU1 mixed-use codes", () => {
    for (const z of ["E1", "E2", "E3", "E4", "E5", "MU1"]) {
      expect(zoneFamily(z)).toBe("business");
    }
  });

  it("keeps former B and IN codes readable as historical employment data", () => {
    for (const z of ["B1", "B7", "IN1", "IN2"]) {
      expect(zoneFamily(z)).toBe("business");
    }
  });

  it("falls back to other for special/recreation/waterway codes", () => {
    for (const z of ["SP2", "RE1", "RE2", "W1", "W2", "DM", "UNKNOWN"]) {
      expect(zoneFamily(z)).toBe("other");
    }
  });

  it("is case- and whitespace-insensitive", () => {
    expect(zoneFamily(" r2 ")).toBe("residential");
    expect(zoneFamily("ru1")).toBe("rural");
  });

  it("returns non-empty Tailwind chip classes for every family", () => {
    for (const z of ["R2", "RU1", "C4", "E2", "SP2"]) {
      expect(zoneChipClasses(z).length).toBeGreaterThan(0);
    }
  });
});

describe("zone presets", () => {
  it("presets contain only codes of their own family", () => {
    for (const preset of ZONE_PRESETS) {
      for (const code of preset.codes) {
        expect(zoneFamily(code)).toBe(preset.family);
      }
    }
  });

  it("presets have no duplicate codes across groups", () => {
    const all = ZONE_PRESETS.flatMap((p) => p.codes);
    expect(new Set(all).size).toBe(all.length);
  });
});
