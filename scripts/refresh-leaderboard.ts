/**
 * Refresh NYC plate leaderboards + percentile buckets in Upstash Redis.
 *
 * One pass through the SODA dataset using :id-based keyset pagination
 * (fast at any depth — doesn't slow down like $offset does). Computes four
 * time-windowed leaderboards (1w / 1m / 1y / all) and writes them to Redis
 * along with date-range metadata so the UI can show "data from <date> to <date>".
 *
 * env vars:
 *   UPSTASH_REDIS_REST_URL       (required)
 *   UPSTASH_REDIS_REST_TOKEN     (required)
 *   NYC_OPEN_DATA_APP_TOKEN      (optional but recommended)
 *   ROWS_TARGET                  (optional — default 80,000,000 ≈ as much as the
 *                                 dataset has; script stops at end-of-data or kill)
 *   FLUSH_EVERY_PAGES            (optional — default 100, write to redis every N pages
 *                                 so progress isn't lost if the runner is killed)
 */
import { Redis } from "@upstash/redis";

const SODA_BASE = "https://data.cityofnewyork.us/resource/nc67-uf89.json";
const PAGE_SIZE = 50_000;
const ROWS_TARGET = Number(process.env.ROWS_TARGET || 80_000_000);
const FLUSH_EVERY_PAGES = Number(process.env.FLUSH_EVERY_PAGES || 100);
const APP_TOKEN = process.env.NYC_OPEN_DATA_APP_TOKEN;
const PAGE_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 5;

type Window = "1w" | "1m" | "1y" | "all";
const WINDOWS: Window[] = ["1w", "1m", "1y", "all"];

type Row = {
  ":id"?: string;
  plate?: string;
  state?: string;
  fine_amount?: string;
  issue_date?: string;
};
type Bucket = { plate: string; state: string; count: number; fines: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Acceptable date range for an NYC ticket: from 2010-01-01 through ~30 days in
// the future. SODA records occasionally have data-entry typos (e.g. year 2096
// instead of 2026); clamping ensures those don't blow up the "data window"
// display or land in the wrong time-window bucket.
const MIN_TS = Date.parse("2010-01-01T00:00:00Z");
const MAX_TS = Date.now() + 30 * 24 * 60 * 60 * 1000;

function parseSodaDate(input: string | undefined): number {
  if (!input) return 0;
  const t = Date.parse(input);
  if (!Number.isFinite(t)) return 0;
  if (t < MIN_TS || t > MAX_TS) return 0;
  return t;
}

function toIsoDay(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchPage(cursor: string | null): Promise<Row[]> {
  const url = new URL(SODA_BASE);
  url.searchParams.set("$select", ":id,plate,state,fine_amount,issue_date");
  url.searchParams.set("$limit", String(PAGE_SIZE));
  url.searchParams.set("$order", ":id DESC");
  if (cursor) url.searchParams.set("$where", `:id < '${cursor}'`);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          ...(APP_TOKEN ? { "X-App-Token": APP_TOKEN } : {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        const wait = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`  ${res.status} on cursor=${cursor ?? "<start>"}, attempt=${attempt + 1}, backing off ${Math.round(wait)}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`SODA ${res.status}: ${body.slice(0, 200)}`);
      }
      return (await res.json()) as Row[];
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const wait = 2000 * Math.pow(2, attempt);
      console.warn(`  fetch failed on cursor=${cursor ?? "<start>"}, attempt=${attempt + 1}:`, err instanceof Error ? err.message : err);
      if (attempt < MAX_RETRIES) await sleep(wait);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("page fetch exhausted retries");
}

function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx]!;
}

function isJunkPlate(plate: string, state: string): boolean {
  const p = plate.toUpperCase();
  if (p === "BLANK" || p === "BLANKPLATE" || p === "NONE" || p === "UNKNOWN" || p === "NOPLATE") return true;
  if (state === "99" || state === "XX") return true;
  return false;
}

interface Meta {
  window: Window;
  computedAt: string;
  oldestIssueDate: string;
  newestIssueDate: string;
  rowsScanned: number;
  uniquePlates: number;
}

async function writeWindows(
  redis: Redis,
  aggs: Record<Window, Map<string, Bucket>>,
  ranges: Record<Window, { min: number; max: number }>,
  totalRows: number,
  ttlSeconds: number,
) {
  for (const w of WINDOWS) {
    const sorted = [...aggs[w].values()].sort((a, b) => b.count - a.count);
    const leaderboard = sorted.slice(0, 500).map((e, i) => ({
      rank: i + 1,
      plate: e.plate,
      state: e.state,
      violationCount: e.count,
      totalFines: Math.round(e.fines * 100) / 100,
    }));
    const meta: Meta = {
      window: w,
      computedAt: new Date().toISOString(),
      oldestIssueDate: toIsoDay(ranges[w].min),
      newestIssueDate: toIsoDay(ranges[w].max),
      rowsScanned: totalRows,
      uniquePlates: aggs[w].size,
    };
    await redis.set(`leaderboard:nyc:${w}`, leaderboard, { ex: ttlSeconds });
    await redis.set(`leaderboard:nyc:${w}:meta`, meta, { ex: ttlSeconds });
  }
  // legacy key for fallback compatibility
  const monthly = (await redis.get<unknown>("leaderboard:nyc:1m")) as unknown;
  if (monthly) await redis.set("leaderboard:nyc", monthly, { ex: ttlSeconds });

  // percentile buckets from the broadest (all) window
  const allCounts = [...aggs.all.values()].map((b) => b.count).sort((a, b) => a - b);
  const percentiles = {
    city: "nyc",
    computedAt: new Date().toISOString(),
    totalPlatesObserved: allCounts.length,
    buckets: {
      p50: Math.max(2, percentile(allCounts, 50)),
      p75: Math.max(3, percentile(allCounts, 75)),
      p90: Math.max(5, percentile(allCounts, 90)),
      p95: Math.max(10, percentile(allCounts, 95)),
      p99: Math.max(25, percentile(allCounts, 99)),
    },
  };
  await redis.set("percentiles:nyc", percentiles, { ex: ttlSeconds });

  // Rank histogram — count of plates at each violation-count value, across the
  // full (all-time) distribution. Lets us compute competition-style rank:
  //   rank(c) = 1 + sum of plates with count > c
  // Ties get the same rank, next distinct count skips by the tie-group size.
  const histogram: Record<string, number> = {};
  for (const c of allCounts) {
    const k = String(c);
    histogram[k] = (histogram[k] || 0) + 1;
  }
  await redis.set("rank_histogram:nyc", histogram, { ex: ttlSeconds });
}

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.error("missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
    process.exit(1);
  }
  const redis = new Redis({ url, token });

  const startedAt = Date.now();
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const cutoffs: Record<Window, number> = {
    "1w": now - 7 * DAY,
    "1m": now - 30 * DAY,
    "1y": now - 365 * DAY,
    "all": 0,
  };

  const aggs: Record<Window, Map<string, Bucket>> = {
    "1w": new Map(),
    "1m": new Map(),
    "1y": new Map(),
    "all": new Map(),
  };
  const ranges: Record<Window, { min: number; max: number }> = {
    "1w": { min: Infinity, max: 0 },
    "1m": { min: Infinity, max: 0 },
    "1y": { min: Infinity, max: 0 },
    "all": { min: Infinity, max: 0 },
  };

  console.log(`refresh-leaderboard: target=${ROWS_TARGET.toLocaleString()} rows, page=${PAGE_SIZE.toLocaleString()}, keyset pagination via :id`);
  if (APP_TOKEN) console.log("using NYC_OPEN_DATA_APP_TOKEN");
  console.log(`flush to redis every ${FLUSH_EVERY_PAGES} pages`);

  // ttl is long because partial writes happen throughout; we want them to stick
  const TTL = 60 * 60 * 48;

  let totalRows = 0;
  let pageIndex = 0;
  let cursor: string | null = null;

  while (totalRows < ROWS_TARGET) {
    const pageStart = Date.now();
    const rows = await fetchPage(cursor);
    const pageMs = Date.now() - pageStart;
    if (rows.length === 0) {
      console.log("end of dataset reached.");
      break;
    }
    let pageMinDate = Infinity;
    let pageMaxDate = 0;
    for (const r of rows) {
      if (!r.plate || !r.state) continue;
      if (isJunkPlate(r.plate, r.state)) continue;
      const key = `${r.state}|${r.plate}`;
      const fine = Number(r.fine_amount) || 0;
      const issuedAt = parseSodaDate(r.issue_date);
      if (issuedAt > 0) {
        if (issuedAt < pageMinDate) pageMinDate = issuedAt;
        if (issuedAt > pageMaxDate) pageMaxDate = issuedAt;
      }
      for (const w of WINDOWS) {
        if (issuedAt >= cutoffs[w]) {
          const m = aggs[w];
          const existing = m.get(key);
          if (existing) {
            existing.count += 1;
            existing.fines += fine;
          } else {
            m.set(key, { plate: r.plate, state: r.state, count: 1, fines: fine });
          }
          if (issuedAt > 0) {
            if (issuedAt < ranges[w].min) ranges[w].min = issuedAt;
            if (issuedAt > ranges[w].max) ranges[w].max = issuedAt;
          }
        }
      }
    }
    totalRows += rows.length;
    pageIndex += 1;
    cursor = rows[rows.length - 1]?.[":id"] ?? null;
    if (!cursor) {
      console.log("no :id on last row — cannot continue, stopping.");
      break;
    }
    const elapsedS = Math.round((Date.now() - startedAt) / 1000);
    const pageOldest = pageMinDate === Infinity ? "—" : toIsoDay(pageMinDate);
    const pageNewest = pageMaxDate === 0 ? "—" : toIsoDay(pageMaxDate);
    console.log(
      `p${pageIndex}: +${rows.length.toLocaleString()} in ${pageMs}ms  total=${totalRows.toLocaleString()}  all-plates=${aggs.all.size.toLocaleString()}  page-dates=${pageOldest}→${pageNewest}  elapsed=${elapsedS}s`,
    );
    if (rows.length < PAGE_SIZE) {
      console.log("partial page — end of dataset.");
      break;
    }
    if (pageIndex % FLUSH_EVERY_PAGES === 0) {
      const flushStart = Date.now();
      await writeWindows(redis, aggs, ranges, totalRows, TTL);
      console.log(`  ↳ flushed to redis (${Date.now() - flushStart}ms)`);
    }
  }

  await writeWindows(redis, aggs, ranges, totalRows, TTL);

  const elapsedS = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\ndone in ${elapsedS}s. ${totalRows.toLocaleString()} rows scanned.`);
  for (const w of WINDOWS) {
    const oldest = ranges[w].min === Infinity ? "—" : toIsoDay(ranges[w].min);
    const newest = ranges[w].max === 0 ? "—" : toIsoDay(ranges[w].max);
    console.log(`  ${w}: ${aggs[w].size.toLocaleString()} unique plates, dates ${oldest} → ${newest}`);
  }
}

main().catch(async (err) => {
  console.error("fatal:", err);
  process.exit(1);
});
