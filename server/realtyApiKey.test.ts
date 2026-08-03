import { describe, expect, it } from "vitest";

/**
 * Validates that REALTY_API_KEY is present and accepted by RealtyAPI.io.
 * Uses the lightweight Domain.com.au autocomplete endpoint as a probe.
 */
describe("REALTY_API_KEY", () => {
  it("is set in the environment", () => {
    expect(process.env.REALTY_API_KEY, "REALTY_API_KEY env var missing").toBeTruthy();
  });

  it("is accepted by RealtyAPI.io", async () => {
    const res = await fetch(
      "https://domain.realtyapi.io/autocomplete?keyword=Sydney",
      {
        headers: { "x-realtyapi-key": process.env.REALTY_API_KEY ?? "" },
      },
    );
    // 401/403 indicate a bad key; anything else means the key was accepted.
    expect([401, 403]).not.toContain(res.status);
    expect(res.ok, `RealtyAPI.io responded with status ${res.status}`).toBe(true);
  }, 30000);
});
