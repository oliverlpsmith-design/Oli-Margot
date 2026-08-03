import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getQldPlanningAtPoint,
  QLD_COUNCIL_MACHINE_COVERAGE,
  QLD_COUNCIL_PARTIAL_COVERAGE,
  QLD_COUNCIL_RULES,
  QLD_DEVELOPMENT_MAPS,
} from "./services/qldPlanning";

function response(features: Array<{ attributes: Record<string, unknown> }>) {
  return new Response(JSON.stringify({ features }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Queensland planning adapter", () => {
  it("publishes only the council sources validated for this release", () => {
    expect(QLD_COUNCIL_MACHINE_COVERAGE).toEqual([
      "gold-coast",
      "moreton-bay",
      "logan",
      "redland",
    ]);
    expect(QLD_COUNCIL_PARTIAL_COVERAGE).toEqual(["mount-isa"]);
    expect(QLD_COUNCIL_RULES.map(rule => [rule.key, rule.confidence])).toEqual([
      ["gold-coast", "high"],
      ["moreton-bay", "high"],
      ["logan", "high"],
      ["redland", "high"],
      ["mount-isa", "partial"],
    ]);
  });

  it("fails closed to manual review for an LGA without a configured council service", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response([{ attributes: { lga: "Brisbane City" } }])),
    );

    const result = await getQldPlanningAtPoint(-27.47, 153.03);
    expect(result).toMatchObject({
      lgaName: "Brisbane City",
      coverage: "manual_review",
      confidence: "manual_review",
      schemeName: null,
      verificationUrl: QLD_DEVELOPMENT_MAPS,
      zoning: { zoneCode: null },
      minimumLotSize: { lotSizeSqm: null },
      bushfire: { status: "unknown" },
      flood: { status: "unknown" },
    });
  });

  it("normalizes validated Gold Coast zoning, lot size, and hazard responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("LandParcelPropertyFramework")) {
          return response([{ attributes: { lga: "Gold Coast City" } }]);
        }
        if (url.includes("City_Plan_V13_Zone")) {
          return response([
            {
              attributes: {
                ZONE: "Low density residential zone",
                ZONE_PRECINCT: "Suburban neighbourhood",
              },
            },
          ]);
        }
        if (url.includes("MinimumLotSize")) {
          return response([{ attributes: { MLS: "600 m2" } }]);
        }
        if (url.includes("MapServer/10/query")) return response([]);
        if (url.includes("MapServer/109/query")) {
          return response([{ attributes: { CAT_DESC: "Flood assessment required" } }]);
        }
        throw new Error(`Unexpected QLD test URL: ${url}`);
      }),
    );

    const result = await getQldPlanningAtPoint(-28.02, 153.4);
    expect(result.coverage).toBe("council_machine");
    expect(result.confidence).toBe("high");
    expect(result.schemeName).toBe("Gold Coast City Plan");
    expect(result.zoning.zoneCode).toBe("Low density residential zone");
    expect(result.minimumLotSize.lotSizeSqm).toBe(600);
    expect(result.bushfire.status).toBe("clear");
    expect(result.flood).toMatchObject({
      status: "flagged",
      detail: "Flood assessment required",
    });
  });

  it("downgrades a configured council to manual review when zoning is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("LandParcelPropertyFramework")) {
          return response([{ attributes: { lga: "Logan City" } }]);
        }
        return response([]);
      }),
    );

    const result = await getQldPlanningAtPoint(-27.64, 153.11);
    expect(result.coverage).toBe("manual_review");
    expect(result.confidence).toBe("manual_review");
    expect(result.zoning.zoneCode).toBeNull();
    expect(result.minimumLotSize.lotSizeSqm).toBeNull();
  });

  it("returns Mount Isa as zoning-only partial coverage with field-level provenance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("LandParcelPropertyFramework")) {
          return response([{ attributes: { lga: "Mount Isa City Council" } }]);
        }
        if (url.includes("Planning_Scheme_Zones")) {
          return response([{ attributes: { ZONE: "Low density residential zone" } }]);
        }
        throw new Error(`Unexpected QLD test URL: ${url}`);
      }),
    );

    const result = await getQldPlanningAtPoint(-20.73, 139.49);

    expect(result).toMatchObject({
      lgaName: "Mount Isa City Council",
      councilKey: "mount-isa",
      coverage: "council_partial",
      confidence: "partial",
      schemeName: "City of Mount Isa Planning Scheme 2020",
      effectiveFrom: "2020-03-09",
      zoning: { zoneCode: "Low density residential zone" },
      minimumLotSize: { lotSizeSqm: null },
      bushfire: { status: "unknown" },
      flood: { status: "unknown" },
      fieldProvenance: {
        zoning: "machine",
        minimumLotSize: "unknown",
        bushfire: "unknown",
        flood: "unknown",
        subdivisionRules: "viewer_only",
      },
      subdivisionRule: "manual_review_required",
    });
  });

  it("keeps every planning field unknown when the statewide LGA service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await getQldPlanningAtPoint(-25.3, 152.8);
    expect(result.coverage).toBe("manual_review");
    expect(result.confidence).toBe("manual_review");
    expect(result.lgaName).toBeNull();
    expect(result.zoning.zoneCode).toBeNull();
    expect(result.bushfire.status).toBe("unknown");
    expect(result.flood.status).toBe("unknown");
  });
});
