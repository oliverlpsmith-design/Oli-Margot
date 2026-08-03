/**
 * Saved-search alert dispatch.
 *
 * Runs after the nightly incremental scan completes. For every saved search,
 * finds ACTIVE catalogue listings first seen since the search was last
 * notified (default: last 24h) that match its filters, then:
 *  - records the matches on the savedSearches row (in-app "new matches" UI)
 *  - sends the project owner one summary notification covering all searches
 *
 * Per-user EMAIL delivery is intentionally not wired yet: the platform's
 * built-in notification channel reaches the project owner only. The
 * `deliverEmail` seam below is where a Resend/SendGrid integration plugs in
 * later without touching the matching logic.
 */
import {
  findNewMatchesForFilters,
  listAllSavedSearchesWithOwners,
  recordSavedSearchMatches,
  type CatalogueBrowseFilters,
} from "../db";
import { notifyOwner } from "../_core/notification";

export interface AlertMatchSnapshot {
  id: number;
  address: string | null;
  suburb: string | null;
  score: number | null;
  priceDisplay: string | null;
  listingUrl: string | null;
}

export interface AlertDispatchResult {
  searchesChecked: number;
  searchesWithMatches: number;
  totalMatches: number;
}

/** Seam for a future per-user email provider (Resend/SendGrid). */
async function deliverEmail(_to: string, _subject: string, _body: string): Promise<void> {
  // No external email provider configured — in-app + owner summary only.
}

export async function dispatchSavedSearchAlerts(now = new Date()): Promise<AlertDispatchResult> {
  const searches = await listAllSavedSearchesWithOwners();
  let searchesWithMatches = 0;
  let totalMatches = 0;
  const summaryLines: string[] = [];

  for (const s of searches) {
    let filters: CatalogueBrowseFilters;
    try {
      filters = JSON.parse(s.filters) as CatalogueBrowseFilters;
    } catch {
      continue;
    }
    const since = s.lastNotifiedAt ?? new Date(now.getTime() - 24 * 3600_000);
    const matches = await findNewMatchesForFilters(filters, since);
    if (!matches.length) continue;

    searchesWithMatches += 1;
    totalMatches += matches.length;

    const snapshot: AlertMatchSnapshot[] = matches.map((m) => ({
      id: m.id,
      address: m.address ?? null,
      suburb: m.suburb ?? null,
      score: m.score ?? null,
      priceDisplay: m.priceDisplay ?? null,
      listingUrl: m.listingUrl ?? null,
    }));
    await recordSavedSearchMatches(s.id, matches.length, JSON.stringify(snapshot));

    const top = matches
      .slice(0, 5)
      .map((m) => `- ${m.address ?? m.suburb ?? `#${m.id}`} (score ${m.score ?? "?"}, ${m.priceDisplay ?? "price n/a"})`)
      .join("\n");
    summaryLines.push(
      `"${s.name}" (${s.userName ?? s.userEmail ?? `user ${s.userId}`}): ${matches.length} new match(es)\n${top}`,
    );

    if (s.userEmail) {
      await deliverEmail(
        s.userEmail,
        `New subdividable matches: ${s.name}`,
        `${matches.length} new properties match your saved search "${s.name}".`,
      ).catch(() => undefined);
    }
  }

  if (summaryLines.length) {
    await notifyOwner({
      title: `Saved-search alerts: ${totalMatches} new matches across ${searchesWithMatches} searches`,
      content: summaryLines.join("\n\n").slice(0, 19_000),
    }).catch(() => undefined);
  }

  return { searchesChecked: searches.length, searchesWithMatches, totalMatches };
}
