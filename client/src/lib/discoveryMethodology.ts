import type { InvestmentTag } from "@/lib/investmentTags";

export type DiscoveryCategory = "subdivision" | InvestmentTag;

export interface DiscoveryCriterion {
  title: string;
  detail: string;
}

export interface DiscoveryMethodology {
  intro: string;
  criteria: DiscoveryCriterion[];
  limitations: string[];
}

export const DISCOVERY_METHODOLOGY: Record<DiscoveryCategory, DiscoveryMethodology> = {
  subdivision: {
    intro:
      "Subdivision candidates are screened from parcel data and current NSW planning layers rather than listing keywords. Lot yield alone is not enough: zoning, frontage and mapped bushfire/flood results now act as explicit gates.",
    criteria: [
      {
        title: "Planning and zoning gates",
        detail:
          "The screen requires parcel land area, mapped minimum lot size and a subdivision-compatible zone code. Residential R1–R5, rural RU1–RU6 and conservation C3–C4 proceed to arithmetic; missing zoning is Unknown and other zones fail this conservative screen.",
      },
      {
        title: "12–15 m Torrens frontage gate",
        detail:
          "A measured frontage below 12 m is excluded. Frontage from 12 m to below 15 m, or frontage that cannot be verified, is capped at Marginal. A frontage of at least 15 m is required for a Subdividable verdict.",
      },
      {
        title: "Bushfire and flood exclusions",
        detail:
          "A verified bushfire-prone-land or mapped flood-planning flag excludes the parcel from the subdivision shortlist. If either government lookup is unavailable, the verdict is capped at Marginal rather than treating missing evidence as clear.",
      },
      {
        title: "Indicative lot-yield rule",
        detail:
          "Land area is divided by the mapped minimum lot size. A ratio of 2.00 or more is tagged Subdividable and potential lots are rounded down; 1.80–1.99 is Marginal; below 1.80 is Not subdividable.",
      },
      {
        title: "0–100 ranking score",
        detail:
          "The base score is 60 for Subdividable, 35 for Marginal, 15 for Unknown and 5 for Not subdividable. Indicative lot yield adds up to 25 points, complete land-area and minimum-lot-size data add up to 10, and an existing dwelling adds a 2-point cash-flow tiebreaker. Scores are capped at 100.",
      },
    ],
    limitations: [
      "The zone-code gate and mapped minimum lot size are conservative planning screens, not confirmation that a consent authority will approve subdivision.",
      "Access, servicing, easements, dwelling placement, biodiversity, slope and council DCP controls can make an apparent split impractical even when the frontage gate passes.",
      "Statewide flood-map coverage is incomplete. Verify all clear and unknown results with council, a current Section 10.7 certificate and the NSW Planning Portal.",
    ],
  },
  pos_geared: {
    intro:
      "Positive-geared candidates must produce positive modelled annual cash flow at the classifier’s current investor-finance and operating-cost assumptions. Price and bedroom count alone no longer qualify a listing.",
    criteria: [
      {
        title: "Evidence required",
        detail:
          "The gate requires a numeric asking price and a weekly rent explicitly advertised as current rent, leased income, rental return or rental appraisal. Ambiguous weekly payment wording is ignored.",
      },
      {
        title: "Current finance model",
        detail:
          "Debt service is modelled as a 30-year principal-and-interest loan at 7.20% with an 80% loan-to-value ratio. The rate is an August 2026 investor-loan screening benchmark, not a personalised quote.",
      },
      {
        title: "Operating-cost model",
        detail:
          "Annual rent is reduced by 4% vacancy, 7% management on collected rent, maintenance at 1% of property value, rates at 0.35% and insurance at 0.25%, then by modelled annual debt service. Only a result above $0 qualifies.",
      },
      {
        title: "Property-type coverage",
        detail:
          "Houses, units and apartments can qualify when the same evidenced net-cash-flow gate passes; no residential property type is admitted from price or bedroom count alone.",
      },
    ],
    limitations: [
      "Rates, insurance and maintenance are screening proxies. Strata, land tax, utilities, letting fees, repairs, depreciation and individual tax effects are not modelled.",
      "Advertised rent and appraisals are not verified leases. Confirm achievable rent, all property-specific expenses and your actual finance terms before relying on a result.",
    ],
  },
  deceased_estate: {
    intro:
      "Deceased-estate listings are classified from explicit estate-sale language in the listing headline and the first 600 characters of its description.",
    criteria: [
      {
        title: "Tier 1 — legal-process wording",
        detail:
          "The strongest text tier requires probate or grant-of-probate wording, or executor/administrator/beneficiary wording in the context of a sale, auction or disposal. Unrelated uses of those roles do not qualify.",
      },
      {
        title: "Tier 2 — explicit estate campaign",
        detail:
          "Explicit phrases such as “deceased estate”, “estate of the late”, “estate sale/liquidation”, “on behalf of the estate” and “instructions of the estate” qualify as an estate campaign. Generic “estate” wording does not.",
      },
    ],
    limitations: [
      "The method relies on listing language and can miss estate sales described indirectly or beyond the first 600 description characters.",
      "The tiers describe the strength of listing-text provenance; they do not independently validate probate records, the vendor’s authority or title documents.",
      "An estate-sale label does not prove a discount, urgency or vendor motivation; price comparisons and campaign timing are separate indicators.",
    ],
  },
  dual_income: {
    intro:
      "Dual-income candidates require both a credible second-dwelling signal and stored planning evidence: at least 450 m² of land and a residential R1–R5 zone.",
    criteria: [
      {
        title: "Secondary-dwelling signals",
        detail:
          "Signals include granny flat, secondary/second/additional dwelling, self-contained unit, studio, flat, cottage or dwelling, detached granny and in-law suite.",
      },
      {
        title: "450 m² and residential-zone gates",
        detail:
          "The Housing SEPP secondary-dwelling screen requires at least 450 m², while the zoning gate requires R1, R2, R3, R4 or R5. Missing lot size or zoning fails closed instead of assuming potential.",
      },
      {
        title: "Two-income and dual-living signals",
        detail:
          "Signals also include dual occupancy/income/living, duplex, two dwellings/homes/houses, house plus granny, separate dwelling and related two-rent wording. “Dual street frontage” alone is excluded.",
      },
    ],
    limitations: [
      "Only the headline and first 600 description characters are scanned, so relevant wording later in a listing can be missed.",
      "The R1–R5 screen does not replace the applicable LEP land-use table, Housing SEPP conditions, council controls or confirmation of an existing dwelling’s lawful approval.",
      "Classification does not confirm separate metering, access, fire separation or two active tenancies.",
    ],
  },
  dev_site: {
    intro:
      "Development-site candidates must combine explicit development evidence, a current NSW development-capable zone and a positive residual-land-value feasibility screen. Marketing wording or FSR alone no longer qualifies a site.",
    criteria: [
      {
        title: "Development wording",
        detail:
          "Signals include development site/opportunity/potential, commercial or mixed-use development, townhouse or unit development, and multi-unit or multi-dwelling wording.",
      },
      {
        title: "Current NSW zoning gate",
        detail:
          "Current employment zones E1, E2, E3, E4 and E5 are recognised alongside MU1, relevant residential zones and special-purpose zones. Obsolete B4/B6 and former IN-zone codes do not pass the current-zone gate.",
      },
      {
        title: "Residual land value quality test",
        detail:
          "Feasibility uses an advertised approved dwelling yield where available, otherwise mapped FSR and site area. Conservative gross realisation, $3,200/m² construction, 20% soft costs, 3% contingency, 2.5% selling costs, $150,000 fixed costs and a 20% developer margin produce an indicative residual value; it must cover the asking price.",
      },
    ],
    limitations: [
      "Only the headline and first 600 description characters are scanned, so qualifying wording later in a listing can be missed.",
      "Listing claims about approvals, yield and plans are not independently validated as current or transferable.",
      "The residual model is a deliberately standardised screen, not a project-specific feasibility; use-specific revenues, demolition, finance, taxes, contamination, infrastructure contributions and holding periods can materially change value.",
    ],
  },
  distressed: {
    intro:
      "Distressed and mortgagee candidates require explicit legal, lender-possession or insolvency-sale provenance. Motivated-vendor, urgency and price-reduction language no longer qualifies a listing.",
    criteria: [
      {
        title: "Tier 1 — possession or court process",
        detail:
          "The strongest text tier includes mortgagee in possession, court-ordered or Sheriff’s sale, repossession, and sale by a named receiver-and-manager or controller.",
      },
      {
        title: "Tier 2 — explicit lender or insolvency sale",
        detail:
          "Explicit mortgagee sale, bank/lender-instructed sale, receivership, liquidator sale and administrator sale wording qualifies. General financial-hardship claims without a legal sale context do not.",
      },
    ],
    limitations: [
      "Only the headline and first 600 description characters are scanned, so relevant wording later in a listing can be missed.",
      "The provenance tiers are based on the listing text and do not independently verify court, security or insolvency records.",
      "Urgent sale, must sell, motivated vendor, below-market and price-reduction wording is deliberately rejected without a qualifying legal signal.",
      "The classifier does not reconstruct historical asking prices; suburb comparisons, campaign age and any available pricing evidence must be reviewed separately.",
    ],
  },
};

export const HOMEPAGE_DISCOVERY_STEPS = [
  {
    title: "Apply versioned evidence gates",
    detail:
      "Each category records auditable gate outcomes: provenance tiers, current zoning, lot size, net cash flow or residual feasibility as applicable.",
  },
  {
    title: "Screen planning and financial risk",
    detail:
      "Subdivision adds frontage and bushfire/flood exclusions; positive gearing uses current-rate debt service and operating costs rather than gross yield.",
  },
  {
    title: "Add due-diligence context",
    detail:
      "Property pages expose stored planning controls, risks, campaign timing and transparent scenarios so users can verify the initial classification.",
  },
] as const;
