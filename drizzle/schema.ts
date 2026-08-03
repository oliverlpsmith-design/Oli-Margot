import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Saved catalogue searches for email alerts. Each user can save up to a
 * handful of filter combinations; the nightly scan notifies them when new
 * listings match.
 */
export const savedSearches = mysqlTable("savedSearches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  /** JSON-serialised CatalogueBrowseFilters subset. */
  filters: text("filters").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Last time an alert email was dispatched for this search. */
  lastNotifiedAt: timestamp("lastNotifiedAt"),
  /** Number of new matches found in the most recent nightly dispatch. */
  lastMatchCount: int("lastMatchCount").default(0).notNull(),
  /** JSON snapshot of the most recent matches (id, address, score, url). */
  lastMatchesJson: text("lastMatchesJson"),
});

export type SavedSearch = typeof savedSearches.$inferSelect;

/**
 * Saved property analyses. Each row captures a property listing snapshot plus
 * the planning data (minimum lot size, zoning) retrieved at analysis time and
 * the computed subdivision potential.
 */
export const savedProperties = mysqlTable("savedProperties", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** External listing identifier from the listings provider (RealtyAPI.io). */
  listingId: varchar("listingId", { length: 64 }),
  address: text("address").notNull(),
  suburb: varchar("suburb", { length: 120 }),
  postcode: varchar("postcode", { length: 8 }),
  state: varchar("state", { length: 8 }).default("NSW").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  /** Advertised price display string, e.g. "$1,200,000" or "Auction". */
  priceDisplay: varchar("priceDisplay", { length: 120 }),
  /** Land area in square metres as reported by the listing. */
  landAreaSqm: decimal("landAreaSqm", { precision: 12, scale: 2 }),
  /** Minimum lot size in square metres from the NSW Planning Portal. */
  minLotSizeSqm: decimal("minLotSizeSqm", { precision: 12, scale: 2 }),
  /** Raw MLS label from the planning layer, e.g. "450 m²" or "40 ha". */
  minLotSizeLabel: varchar("minLotSizeLabel", { length: 64 }),
  /** Name of the environmental planning instrument, e.g. an LEP name. */
  epiName: text("epiName"),
  lgaName: varchar("lgaName", { length: 120 }),
  /** Zone code or descriptive scheme-zone name, e.g. "R2" or "Low Density Residential Zone". */
  zoneCode: varchar("zoneCode", { length: 120 }),
  zoneDescription: text("zoneDescription"),
  /** Estimated number of lots achievable: floor(landArea / minLotSize). */
  potentialLots: int("potentialLots"),
  /** Simple subdivision potential verdict computed at analysis time. */
  verdict: mysqlEnum("verdict", ["subdividable", "marginal", "not_subdividable", "unknown"])
    .default("unknown")
    .notNull(),
  /** Listing URL back to the source portal. */
  listingUrl: text("listingUrl"),
  /** Primary listing photo URL. */
  imageUrl: text("imageUrl"),
  /** Free-form user notes. */
  notes: text("notes"),
  /** Full raw analysis payload for future reference. */
  rawData: json("rawData"),
  isArchived: boolean("isArchived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SavedProperty = typeof savedProperties.$inferSelect;
export type InsertSavedProperty = typeof savedProperties.$inferInsert;

/**
 * Search history so users can revisit prior research sessions.
 */
export const searchHistory = mysqlTable("searchHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  location: varchar("location", { length: 200 }).notNull(),
  filters: json("filters"),
  resultCount: int("resultCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SearchHistoryEntry = typeof searchHistory.$inferSelect;

/**
 * Comprehensive catalogue of analysed NSW listings. One row per unique
 * realestate.com.au listing id. Populated by the sweep engine (initial full
 * sweep + nightly incremental scans) — NOT by interactive searches.
 */
export const catalogueListings = mysqlTable("catalogueListings", {
  id: int("id").autoincrement().primaryKey(),
  /** realestate.com.au listing id (unique). */
  listingId: varchar("listingId", { length: 32 }).notNull().unique(),
  address: text("address"),
  suburb: varchar("suburb", { length: 120 }),
  postcode: varchar("postcode", { length: 8 }),
  state: varchar("state", { length: 8 }).default("NSW").notNull(),
  /** Region id from shared/regions.ts the listing was discovered under. */
  regionId: varchar("regionId", { length: 64 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  propertyType: varchar("propertyType", { length: 64 }),
  priceDisplay: varchar("priceDisplay", { length: 160 }),
  /** Parsed numeric asking price in AUD, when extractable from priceDisplay (null for auctions/POA). */
  priceNumeric: decimal("priceNumeric", { precision: 14, scale: 2 }),
  bedrooms: int("bedrooms"),
  bathrooms: int("bathrooms"),
  landAreaSqm: decimal("landAreaSqm", { precision: 12, scale: 2 }),
  minLotSizeSqm: decimal("minLotSizeSqm", { precision: 12, scale: 2 }),
  minLotSizeLabel: varchar("minLotSizeLabel", { length: 64 }),
  /** NSW codes or descriptive QLD planning-scheme zone names. */
  zoneCode: varchar("zoneCode", { length: 120 }),
  lgaName: varchar("lgaName", { length: 120 }),
  potentialLots: int("potentialLots"),
  verdict: mysqlEnum("verdict", ["subdividable", "marginal", "not_subdividable", "unknown"])
    .default("unknown")
    .notNull(),
  score: int("score").default(0).notNull(),
  category: mysqlEnum("category", ["cash_flow", "land_only", "unknown"]).default("unknown").notNull(),
  status: mysqlEnum("status", ["active", "sold", "removed"]).default("active").notNull(),
  /** Dwelling floor area (m²) from REA building_size when reported (~50% of rows, mostly new builds). */
  buildingSizeSqm: decimal("buildingSizeSqm", { precision: 12, scale: 2 }),
  /** Dwelling footprint coverage: buildingSize / landArea * 100, when both known. */
  coveragePct: decimal("coveragePct", { precision: 5, scale: 1 }),
  /** Lot frontage/width in metres, regex-parsed from free-text description when mentioned. */
  frontageM: decimal("frontageM", { precision: 6, scale: 1 }),
  /** True when REA construction_status = "new" or strong new-build keywords found. */
  isNewBuild: boolean("isNewBuild").default(false).notNull(),
  /** True when new-estate / house-and-land keywords found in headline/description. */
  hasEstateKeywords: boolean("hasEstateKeywords").default(false).notNull(),
  /**
   * Pipe-separated investment category tags derived from the current gated classifier.
   * Values: deceased_estate | dual_income | distressed | dev_site | pos_geared
   * Empty string = no special tags. Multiple tags separated by |.
   * Example: "deceased_estate|dev_site"
   */
  investmentTags: varchar("investmentTags", { length: 255 }).default("").notNull(),
  /** Classifier ruleset version applied to investmentTags and classificationEvidence. */
  classifierVersion: int("classifierVersion").default(1).notNull(),
  /** Auditable gate outcomes and assumptions used for the current automatic tags. */
  classificationEvidence: json("classificationEvidence"),
  listingUrl: text("listingUrl"),
  imageUrl: text("imageUrl"),
  headline: text("headline"),
  /**
   * First 500 characters of the REA listing description.
   * Used by the investment classifier for richer keyword matching.
   */
  descriptionShort: varchar("descriptionShort", { length: 512 }),
  /**
   * Acid Sulfate Soils class from NSW Planning Portal Protection service.
   * Values: "Class 1" | "Class 2" | "Class 3" | "Class 4" | "Class 5" | null (not mapped).
   */
  acidSulfateClass: varchar("acidSulfateClass", { length: 16 }),
  /**
   * Maximum Floor Space Ratio from NSW EPI Primary Planning Layers (FSR map).
   * Stored as a decimal ratio, e.g. 0.5 means 0.5:1. Null = not mapped in LEP.
   */
  fsrValue: decimal("fsrValue", { precision: 5, scale: 2 }),
  /**
   * Maximum building height in metres from NSW EPI Primary Planning Layers (HOB map).
   * Null = not mapped in LEP (no height limit or not yet submitted to state portal).
   */
  maxBuildingHeightM: decimal("maxBuildingHeightM", { precision: 6, scale: 1 }),
  /**
   * Bushfire prone land category from NSW RFS BFPL service.
   * Comma-separated categories, e.g. "Vegetation Category 1" or "Vegetation Category 1, Vegetation Buffer".
   * Null = not mapped as bush fire prone land.
   */
  bushfireCategory: varchar("bushfireCategory", { length: 120 }),
  /** Explicit lookup state so null category is not confused with an unavailable lookup. */
  bushfireStatus: mysqlEnum("bushfireStatus", ["clear", "flagged", "unknown"])
    .default("unknown")
    .notNull(),
  /**
   * Flood planning area flag from NSW Planning Portal Hazard service.
   * "flagged" = within a mapped flood planning area; null = no stored detail.
   */
  floodRisk: varchar("floodRisk", { length: 16 }),
  /** Explicit lookup state so null detail is not confused with an unavailable lookup. */
  floodStatus: mysqlEnum("floodStatus", ["clear", "flagged", "unknown"])
    .default("unknown")
    .notNull(),
  /**
   * Heritage constraint flag. Stores first heritage item name (truncated) when flagged.
   * Null = no heritage item or conservation area mapped.
   */
  heritageFlag: varchar("heritageFlag", { length: 120 }),
  /**
   * Biodiversity Values Map flag.
   * "flagged" = on the BVM; null = clear or unknown.
   */
  biodiversityFlag: varchar("biodiversityFlag", { length: 16 }),
  /**
   * Estimated first-listed time. From REA's "Added X ago" badge at analysis
   * time when available, else firstSeenAt. Drives days-on-market.
   */
  listedAt: timestamp("listedAt"),
  /** When the sweep first discovered this listing. */
  firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
  /** Last sweep that confirmed the listing still active on the buy channel. */
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  /** When the listing was detected sold/removed. */
  soldDetectedAt: timestamp("soldDetectedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CatalogueListing = typeof catalogueListings.$inferSelect;
export type InsertCatalogueListing = typeof catalogueListings.$inferInsert;

/**
 * Scan-run log for the sweep engine. One row per full-sweep or incremental
 * run; drives observability and the "last updated" indicator in the UI.
 */
export const scanRuns = mysqlTable("scanRuns", {
  id: int("id").autoincrement().primaryKey(),
  mode: mysqlEnum("mode", ["full_sweep", "incremental"]).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  /** Progress checkpoint (JSON): region cursor, page cursor — allows resume. */
  cursor: json("cursor"),
  listingsSeen: int("listingsSeen").default(0).notNull(),
  listingsAnalysed: int("listingsAnalysed").default(0).notNull(),
  listingsAdded: int("listingsAdded").default(0).notNull(),
  listingsMarkedSold: int("listingsMarkedSold").default(0).notNull(),
  error: text("error"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

export type ScanRun = typeof scanRuns.$inferSelect;

/**
 * Audit log for scheduled and admin-triggered AI Investment Analyst runs.
 * A failed or partial run is never used for current public picks.
 */
export const aiAnalystRuns = mysqlTable(
  "aiAnalystRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Unique non-null value while a run owns the global analyst lock. */
    activeLock: varchar("activeLock", { length: 16 }),
    trigger: mysqlEnum("trigger", ["scheduled", "admin"]).notNull(),
    status: mysqlEnum("status", ["running", "completed", "failed"])
      .default("running")
      .notNull(),
    /** Latest completed catalogue scan known when analysis started. */
    sourceScanRunId: int("sourceScanRunId"),
    /** Heartbeat task identifier for scheduled callbacks. */
    taskUid: varchar("taskUid", { length: 96 }),
    /** Admin user who requested a manual run. */
    requestedByUserId: int("requestedByUserId"),
    primaryModel: varchar("primaryModel", { length: 80 }).notNull(),
    fallbackModel: varchar("fallbackModel", { length: 80 }).notNull(),
    candidateCount: int("candidateCount").default(0).notNull(),
    scoredCount: int("scoredCount").default(0).notNull(),
    reusedCount: int("reusedCount").default(0).notNull(),
    llmCallCount: int("llmCallCount").default(0).notNull(),
    promptTokens: int("promptTokens").default(0).notNull(),
    completionTokens: int("completionTokens").default(0).notNull(),
    error: text("error"),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    finishedAt: timestamp("finishedAt"),
  },
  table => [
    uniqueIndex("aiAnalystRuns_active_lock_uq").on(table.activeLock),
    index("aiAnalystRuns_status_started_idx").on(table.status, table.startedAt),
    index("aiAnalystRuns_completed_finished_idx").on(table.status, table.finishedAt),
  ],
);

export type AiAnalystRun = typeof aiAnalystRuns.$inferSelect;
export type InsertAiAnalystRun = typeof aiAnalystRuns.$inferInsert;

/**
 * Historical, evidence-auditable property scores produced for each analyst
 * persona. Current picks are the ranked rows from the latest completed run.
 */
export const aiAgentScores = mysqlTable(
  "aiAgentScores",
  {
    id: int("id").autoincrement().primaryKey(),
    runId: int("runId").notNull(),
    catalogueListingId: int("catalogueListingId").notNull(),
    personaKey: mysqlEnum("personaKey", [
      "subdivider",
      "cash_flow_hunter",
      "value_finder",
    ]).notNull(),
    hypotheticalBudget: int("hypotheticalBudget").notNull(),
    qualityScore: int("qualityScore").notNull(),
    evidenceConfidence: int("evidenceConfidence").notNull(),
    deterministicScore: int("deterministicScore").notNull(),
    recommendationRank: int("recommendationRank"),
    eligible: boolean("eligible").default(true).notNull(),
    /** `reused` means the structured result was copied after an unchanged fingerprint. */
    analysisSource: mysqlEnum("analysisSource", ["primary", "fallback", "reused"])
      .notNull(),
    inputFingerprint: varchar("inputFingerprint", { length: 64 }).notNull(),
    model: varchar("model", { length: 80 }).notNull(),
    rationale: text("rationale").notNull(),
    keyEvidence: json("keyEvidence").notNull(),
    materialRisks: json("materialRisks").notNull(),
    unknowns: json("unknowns").notNull(),
    scoreComponents: json("scoreComponents").notNull(),
    scenarioAssumptions: json("scenarioAssumptions"),
    promptTokens: int("promptTokens").default(0).notNull(),
    completionTokens: int("completionTokens").default(0).notNull(),
    analysedAt: timestamp("analysedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("aiAgentScores_run_persona_listing_uq").on(
      table.runId,
      table.personaKey,
      table.catalogueListingId,
    ),
    index("aiAgentScores_current_picks_idx").on(
      table.runId,
      table.personaKey,
      table.recommendationRank,
    ),
    index("aiAgentScores_reuse_idx").on(
      table.catalogueListingId,
      table.personaKey,
      table.analysedAt,
    ),
  ],
);

export type AiAgentScore = typeof aiAgentScores.$inferSelect;
export type InsertAiAgentScore = typeof aiAgentScores.$inferInsert;
