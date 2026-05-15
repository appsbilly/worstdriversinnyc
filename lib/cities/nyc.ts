import { cacheGet, cacheSet, TTL } from "../cache";
import { normalizePlate, normalizeState } from "../format";
import {
  CityAdapter,
  InvalidPlateError,
  LeaderboardEntry,
  LeaderboardMeta,
  LeaderboardWindow,
  OwnershipSignal,
  PercentileBuckets,
  PlateLookupResult,
  RankInfo,
  UpstreamApiError,
  Violation,
} from "./types";

const SODA_BASE = "https://data.cityofnewyork.us/resource/nc67-uf89.json";
const NYC_PORTAL = "https://www.nyc.gov/site/finance/vehicles/services-violations.page";

type SodaRow = {
  plate?: string;
  state?: string;
  license_type?: string;
  summons_number?: string;
  issue_date?: string;
  violation?: string;
  violation_status?: string;
  fine_amount?: string;
  penalty_amount?: string;
  interest_amount?: string;
  reduction_amount?: string;
  payment_amount?: string;
  amount_due?: string;
  precinct?: string;
  county?: string;
  issuing_agency?: string;
  judgment_entry_date?: string;
  summons_image?: { url?: string; description?: string };
};

function n(v: string | undefined): number {
  if (!v) return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function deriveStatus(row: SodaRow): Violation["status"] {
  const due = n(row.amount_due);
  const paid = n(row.payment_amount);
  const fine = n(row.fine_amount);
  const reduction = n(row.reduction_amount);
  if (row.violation_status && /dispute|hearing pending/i.test(row.violation_status)) {
    return "in_dispute";
  }
  if (due > 0) return "unpaid";
  if (paid > 0) return "paid";
  // due=0, paid=0 — the ticket isn't outstanding but nothing was paid either.
  // If a reduction was applied, the ticket was forgiven (common with first-time
  // offenders or successful disputes). If everything is zero, the record is
  // ambiguous (could be a voided ticket or incomplete data).
  if (reduction > 0 || fine > 0) return "dismissed";
  return "unknown";
}

function toIsoDate(input: string | undefined): string {
  if (!input) return "";
  // SODA returns either MM/DD/YYYY or a full ISO string for some columns.
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(input);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  // already ISO-ish — let Date parse it and re-emit yyyy-mm-dd
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return input;
}

function toViolation(row: SodaRow): Violation {
  // Show the gross face value of the ticket (what the violator was charged),
  // not the post-reduction net. A reduced/dismissed ticket still had an original
  // fine; subtracting the reduction hides that and produces misleading "$0" displays.
  const fineAmount = n(row.fine_amount) + n(row.penalty_amount) + n(row.interest_amount);
  const amountPaid = n(row.payment_amount);
  const amountDue = n(row.amount_due);
  const locationParts = [row.precinct, row.county].filter(Boolean);
  return {
    id: row.summons_number || `${row.plate}-${row.issue_date}-${row.violation}`,
    issueDate: toIsoDate(row.issue_date),
    violationType: humanizeViolation(row.violation || "Unknown violation"),
    location: locationParts.length ? locationParts.join(", ") : undefined,
    fineAmount: Math.max(0, Math.round(fineAmount * 100) / 100),
    amountPaid: Math.round(amountPaid * 100) / 100,
    amountDue: Math.round(amountDue * 100) / 100,
    status: deriveStatus(row),
    imageUrl: row.summons_image?.url,
    issuingAgency: row.issuing_agency,
    precinct: row.precinct,
  };
}

function humanizeViolation(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bphto\b/g, "photo")
    .replace(/\bzn\b/g, "zone")
    .replace(/\bspd\b/g, "speed")
    .replace(/\bviol\b/g, "violation")
    .replace(/\bno standing\b/gi, "no standing")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SodaFetchOptions {
  searchParams: Record<string, string>;
  retries?: number;
  timeoutMs?: number;
}

async function sodaFetch<T>({
  searchParams,
  retries = 3,
  timeoutMs = 12_000,
}: SodaFetchOptions): Promise<T> {
  const token = process.env.NYC_OPEN_DATA_APP_TOKEN;
  const url = new URL(SODA_BASE);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          ...(token ? { "X-App-Token": token } : {}),
        },
        signal: controller.signal,
        // server-only fetch — let upstream's CDN cache as it sees fit
        cache: "no-store",
      });
      clearTimeout(timer);

      if (res.status === 429) {
        const wait = 500 * Math.pow(2, attempt) + Math.random() * 250;
        await new Promise((r) => setTimeout(r, wait));
        attempt += 1;
        continue;
      }
      if (res.status >= 500) {
        if (attempt < retries) {
          const wait = 400 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, wait));
          attempt += 1;
          continue;
        }
        throw new UpstreamApiError(res.status, `SODA ${res.status}`);
      }
      if (!res.ok) {
        throw new UpstreamApiError(res.status, `SODA error ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        const wait = 400 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, wait));
        attempt += 1;
        continue;
      }
      break;
    }
  }
  if (lastError instanceof UpstreamApiError) throw lastError;
  throw new UpstreamApiError(0, `SODA fetch failed: ${(lastError as Error)?.message || "unknown"}`);
}

async function fetchAllViolationsForPlate(plate: string, state: string): Promise<SodaRow[]> {
  const PAGE = 1000;
  const HARD_CAP = 5000;
  const out: SodaRow[] = [];
  let offset = 0;
  while (out.length < HARD_CAP) {
    const rows = await sodaFetch<SodaRow[]>({
      searchParams: {
        plate,
        state,
        $limit: String(PAGE),
        $offset: String(offset),
        $order: "issue_date DESC",
      },
    });
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

async function fetchLookupFresh(plate: string, state: string): Promise<PlateLookupResult> {
  const normPlate = normalizePlate(plate);
  const normState = normalizeState(state);
  if (!normPlate) throw new InvalidPlateError();

  // primary query, then a "T"-prefix variant for temp plates if no results
  let rows = await fetchAllViolationsForPlate(normPlate, normState);
  if (rows.length === 0 && !normPlate.startsWith("T")) {
    const alt = await fetchAllViolationsForPlate(`T${normPlate}`, normState);
    if (alt.length > 0) rows = alt;
  }

  const violations = rows.map(toViolation);
  violations.sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));

  const ownershipSignals = detectOwnershipSignals(rows);

  let paid = 0;
  let unpaid = 0;
  let dismissed = 0;
  let totalIssued = 0;
  let totalPaid = 0;
  let totalDue = 0;
  for (const v of violations) {
    if (v.status === "paid") paid += 1;
    else if (v.status === "unpaid") unpaid += 1;
    else if (v.status === "dismissed") dismissed += 1;
    totalIssued += v.fineAmount;
    totalPaid += v.amountPaid;
    totalDue += v.amountDue;
  }

  return {
    city: "nyc",
    plate: normPlate,
    state: normState,
    totalViolations: violations.length,
    totalPaid: paid,
    totalUnpaid: unpaid,
    totalDismissed: dismissed,
    totalFinesIssued: Math.round(totalIssued * 100) / 100,
    totalFinesPaid: Math.round(totalPaid * 100) / 100,
    totalFinesOutstanding: Math.round(totalDue * 100) / 100,
    firstViolationDate: violations.length ? violations[violations.length - 1]!.issueDate : undefined,
    lastViolationDate: violations.length ? violations[0]!.issueDate : undefined,
    violations,
    ownershipSignals,
    cityPortalUrl: NYC_PORTAL,
  };
}

/**
 * Look for evidence in the raw SODA rows that this plate may have changed
 * ownership. We don't have explicit transfer data, so we use two heuristics:
 *
 *  1. license_type changes between consecutive violations (e.g. PAS → COM).
 *     The license_type maps to vehicle class; a real change strongly suggests
 *     the plate was moved to a different vehicle (often with a new owner).
 *  2. Long gaps in ticket activity (18+ months) followed by resumed activity.
 *     Plates that go inactive for that long are often surrendered and reissued.
 *
 * Both are heuristic — we surface them as "signals" not "facts".
 */
function detectOwnershipSignals(rows: SodaRow[]): OwnershipSignal[] {
  // sort chronologically (oldest first) using normalized ISO dates
  const sorted = rows
    .map((r) => ({ row: r, ts: Date.parse(toIsoDate(r.issue_date)) }))
    .filter((x) => Number.isFinite(x.ts) && x.ts > 0)
    .sort((a, b) => a.ts - b.ts);
  if (sorted.length < 2) return [];

  const signals: OwnershipSignal[] = [];
  const seenKeys = new Set<string>();
  const GAP_DAYS = 548; // ~18 months
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;

    // (1) license_type change — only count meaningful values
    const prevType = (prev.row.license_type || "").toUpperCase().trim();
    const currType = (curr.row.license_type || "").toUpperCase().trim();
    if (
      prevType &&
      currType &&
      prevType !== currType &&
      prevType !== "999" &&
      currType !== "999"
    ) {
      const key = `lt:${currType}@${toIsoDate(curr.row.issue_date)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        signals.push({
          detectedAt: toIsoDate(curr.row.issue_date),
          kind: "license_type_change",
          detail: `vehicle class changed from ${prevType} to ${currType}`,
        });
      }
    }

    // (2) long gap
    const gapDays = (curr.ts - prev.ts) / MS_PER_DAY;
    if (gapDays >= GAP_DAYS) {
      const key = `gap:${toIsoDate(curr.row.issue_date)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        signals.push({
          detectedAt: toIsoDate(curr.row.issue_date),
          kind: "long_gap",
          detail: `${Math.round(gapDays / 30)}-month gap in ticket activity`,
        });
      }
    }
  }

  // De-dup overlapping signals on the same date (e.g. license type change +
  // long gap at the same moment) — prefer license_type signal as the stronger.
  const byDate = new Map<string, OwnershipSignal>();
  for (const s of signals) {
    const existing = byDate.get(s.detectedAt);
    if (!existing || (s.kind === "license_type_change" && existing.kind !== "license_type_change")) {
      byDate.set(s.detectedAt, s);
    }
  }
  return [...byDate.values()].sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1));
}

// Bump this when the shape/semantics of PlateLookupResult change so old
// cache entries are skipped on the next request instead of serving stale data.
const LOOKUP_CACHE_VERSION = 4;

async function lookup(plate: string, state: string): Promise<PlateLookupResult> {
  const normPlate = normalizePlate(plate);
  const normState = normalizeState(state);
  if (!normPlate) throw new InvalidPlateError();
  const key = `lookup:nyc:v${LOOKUP_CACHE_VERSION}:${normState}:${normPlate}`;
  const cached = await cacheGet<PlateLookupResult>(key);
  if (cached) return cached;
  const fresh = await fetchLookupFresh(normPlate, normState);
  await cacheSet(key, fresh, TTL.LOOKUP);
  return fresh;
}

type RecentRow = { plate?: string; state?: string; fine_amount?: string };

async function fetchLeaderboardFresh(limit: number): Promise<LeaderboardEntry[]> {
  // SODA can't GROUP BY across the whole table within a 60s function budget,
  // and $order=issue_date with $offset pagination forces a full sort that's
  // also too slow. Instead we pull a single large slice using SODA's always-
  // indexed system row id (`:id DESC`) — that gives us the most-recently-
  // inserted rows essentially for free, no sort required.
  type Bucket = { plate: string; state: string; count: number; fines: number };
  const buckets = new Map<string, Bucket>();

  const rows = await sodaFetch<RecentRow[]>({
    searchParams: {
      $select: "plate,state,fine_amount",
      $limit: "50000",
      $order: ":id DESC",
    },
    timeoutMs: 45_000,
  });

  for (const r of rows) {
    if (!r.plate || !r.state) continue;
    const key = `${r.state}|${r.plate}`;
    const fine = Number(r.fine_amount) || 0;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.fines += fine;
    } else {
      buckets.set(key, { plate: r.plate, state: r.state, count: 1, fines: fine });
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  return sorted.slice(0, Math.max(1, Math.min(limit, 500))).map((e, i) => ({
    rank: i + 1,
    plate: e.plate,
    state: e.state,
    violationCount: e.count,
    totalFines: Math.round(e.fines * 100) / 100,
  }));
}

async function getLeaderboard(
  limit: number,
  window: LeaderboardWindow = "1m",
): Promise<LeaderboardEntry[]> {
  const key = `leaderboard:nyc:${window}`;
  const cached = await cacheGet<LeaderboardEntry[]>(key);
  if (cached && cached.length) return cached.slice(0, limit);
  // Fallback to the legacy un-windowed key for transition.
  const legacy = await cacheGet<LeaderboardEntry[]>(`leaderboard:nyc`);
  if (legacy && legacy.length) return legacy.slice(0, limit);
  return [];
}

async function getLeaderboardMeta(
  window: LeaderboardWindow,
): Promise<LeaderboardMeta | null> {
  const key = `leaderboard:nyc:${window}:meta`;
  return (await cacheGet<LeaderboardMeta>(key)) ?? null;
}

function defaultBuckets(): PercentileBuckets {
  return {
    city: "nyc",
    computedAt: new Date().toISOString(),
    totalPlatesObserved: 0,
    buckets: { p50: 2, p75: 5, p90: 12, p95: 25, p99: 75 },
  };
}

async function getRankHistogram(): Promise<Record<string, number> | null> {
  return (await cacheGet<Record<string, number>>(`rank_histogram:nyc`)) ?? null;
}

async function getRank(
  violationCount: number,
  totalFines?: number,
): Promise<RankInfo | null> {
  if (violationCount <= 0) return null;
  const hist = await cacheGet<Record<string, number>>(`rank_histogram:nyc`);
  if (!hist) return null;
  let rank = 1;
  let total = 0;
  for (const [k, n] of Object.entries(hist)) {
    const count = Number(k);
    const plates = Number(n) || 0;
    total += plates;
    if (count > violationCount) rank += plates;
  }
  if (total === 0) return null;

  // Tie-break within the same ticket count by total fines, using the per-count
  // fine-quantile table the refresh script writes. Approximate to 5%.
  if (typeof totalFines === "number" && totalFines >= 0) {
    const tieGroupSize = Number(hist[String(violationCount)] || 0);
    const quantiles = await cacheGet<Record<string, number[]>>(`rank_fine_quantiles:nyc`);
    const breaks = quantiles?.[String(violationCount)];
    if (tieGroupSize > 0 && breaks && breaks.length === 21) {
      // breaks[i] = the fine value at the (i*5)th percentile of plates with
      // this exact ticket count. Find the highest i where breaks[i] <= my fines.
      let percentileAtOrBelow = 0;
      for (let i = breaks.length - 1; i >= 0; i--) {
        if (totalFines >= breaks[i]!) {
          percentileAtOrBelow = i * 5;
          break;
        }
      }
      // Fraction of the tie group with strictly higher fines than me.
      const fractionAhead = Math.max(0, (100 - percentileAtOrBelow) / 100);
      rank += Math.floor(tieGroupSize * fractionAhead);
    }
  }

  return { rank, total };
}

async function getPercentile(violationCount: number): Promise<number> {
  const key = `percentiles:nyc`;
  const buckets = (await cacheGet<PercentileBuckets>(key)) || defaultBuckets();
  const { p50, p75, p90, p95, p99 } = buckets.buckets;
  // returns top X%: lower number = worse driver
  if (violationCount >= p99) return 1;
  if (violationCount >= p95) return 5;
  if (violationCount >= p90) return 10;
  if (violationCount >= p75) return 25;
  if (violationCount >= p50) return 50;
  return 75;
}

export async function computeAndCachePercentiles(
  leaderboard: LeaderboardEntry[],
): Promise<PercentileBuckets> {
  // Use leaderboard distribution as proxy. For a robust implementation we'd
  // sample additional plates, but the top-500 distribution gives reasonable cutpoints.
  const counts = leaderboard.map((e) => e.violationCount).sort((a, b) => a - b);
  function pct(p: number): number {
    if (!counts.length) return 0;
    const idx = Math.min(counts.length - 1, Math.floor((p / 100) * counts.length));
    return counts[idx]!;
  }
  const buckets: PercentileBuckets = {
    city: "nyc",
    computedAt: new Date().toISOString(),
    totalPlatesObserved: counts.length,
    buckets: {
      p50: Math.max(2, pct(50)),
      p75: Math.max(3, pct(75)),
      p90: Math.max(5, pct(90)),
      p95: Math.max(10, pct(95)),
      p99: Math.max(25, pct(99)),
    },
  };
  await cacheSet(`percentiles:nyc`, buckets, TTL.PERCENTILES);
  return buckets;
}

export async function refreshNycLeaderboard(): Promise<{
  leaderboardCount: number;
  buckets: PercentileBuckets;
}> {
  const fresh = await fetchLeaderboardFresh(500);
  await cacheSet(`leaderboard:nyc`, fresh, TTL.LEADERBOARD);
  const buckets = await computeAndCachePercentiles(fresh);
  return { leaderboardCount: fresh.length, buckets };
}

export const nycAdapter: CityAdapter = {
  id: "nyc",
  name: "New York City",
  shortName: "NYC",
  enabled: true,
  supportedStates: [
    "NY", "NJ", "CT", "PA", "MA", "FL", "TX", "CA", "VA", "MD", "DE", "RI",
    "VT", "NH", "ME", "OH", "IL", "GA", "NC", "SC", "DC",
  ],
  cityPortalUrl: NYC_PORTAL,
  lookup,
  getLeaderboard,
  getLeaderboardMeta,
  getPercentile,
  getRank,
  getRankHistogram,
};
