/**
 * Refresh NYC plate leaderboards + percentile buckets in Upstash Redis.
 *
 * One pass through the SODA dataset, four time-windowed leaderboards
 * (1w / 1m / 1y / all). Runs from GitHub Actions — no Vercel 60s cap.
 *
 * env vars:
 *   UPSTASH_REDIS_REST_URL       (required)
 *   UPSTASH_REDIS_REST_TOKEN     (required)
 *   NYC_OPEN_DATA_APP_TOKEN      (optional but recommended)
 *   ROWS_TARGET                  (optional — default 10,000,000)
 */
import { Redis } from "@upstash/redis";

const SODA_BASE = "https://data.cityofnewyork.us/resource/nc67-uf89.json";
const PAGE_SIZE = 50_000;
const ROWS_TARGET = Number(process.env.ROWS_TARGET || 10_000_000);
const APP_TOKEN = process.env.NYC_OPEN_DATA_APP_TOKEN;
const PAGE_TIMEOUT_MS = 180_000;
const MAX_RETRIES = 4;

type Window = "1w" | "1m" | "1y" | "all";
const WINDOWS: Window[] = ["1w", "1m", "1y", "all"];

type Row = { plate?: string; state?: string; fine_amount?: string; issue_date?: string };
type Bucket = { plate: string; state: string; count: number; fines: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseSodaDate(input: string | undefined): number {
  if (!input) return 0;
  // SODA returns either MM/DD/YYYY or full ISO. Date.parse handles both well enough.
  const t = Date.parse(input);
  return Number.isFinite(t) ? t : 0;
}

async function fetchPage(offset: number): Promise<Row[]> {
  const url = new URL(SODA_BASE);
  url.searchParams.set("$select", "plate,state,fine_amount,issue_date");
  url.searchParams.set("$limit", String(PAGE_SIZE));
  url.searchParams.set("$offset", String(offset));
  url.searchParams.set("$order", ":id DESC");

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
        console.warn(`  ${res.status} on offset=${offset}, attempt=${attempt + 1}, backing off ${Math.round(wait)}ms`);
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
      console.warn(`  fetch failed on offset=${offset}, attempt=${attempt + 1}:`, err instanceof Error ? err.message : err);
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

  console.log(`refresh-leaderboard: targeting ${ROWS_TARGET.toLocaleString()} rows, page size ${PAGE_SIZE.toLocaleString()}`);
  if (APP_TOKEN) console.log("using NYC_OPEN_DATA_APP_TOKEN");

  let totalRows = 0;
  let pageIndex = 0;
  let oldestSeenIso = "";

  while (totalRows < ROWS_TARGET) {
    const offset = pageIndex * PAGE_SIZE;
    const pageStart = Date.now();
    const rows = await fetchPage(offset);
    const pageMs = Date.now() - pageStart;
    if (rows.length === 0) {
      console.log("end of dataset reached.");
      break;
    }
    for (const r of rows) {
      if (!r.plate || !r.state) continue;
      // skip junk plates (missing/obscured/unknown) — these are tickets where
      // the plate couldn't be read and would otherwise dominate the leaderboard
      const plateUpper = r.plate.toUpperCase();
      if (
        plateUpper === "BLANK" ||
        plateUpper === "BLANKPLATE" ||
        plateUpper === "NONE" ||
        plateUpper === "UNKNOWN" ||
        plateUpper === "NOPLATE" ||
        r.state === "99" ||
        r.state === "XX"
      ) {
        continue;
      }
      const key = `${r.state}|${r.plate}`;
      const fine = Number(r.fine_amount) || 0;
      const issuedAt = parseSodaDate(r.issue_date);
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
        }
      }
      if (r.issue_date && (!oldestSeenIso || r.issue_date < oldestSeenIso)) {
        oldestSeenIso = r.issue_date;
      }
    }
    totalRows += rows.length;
    pageIndex += 1;
    const elapsedS = Math.round((Date.now() - startedAt) / 1000);
    console.log(
      `page ${pageIndex}: +${rows.length.toLocaleString()} rows in ${pageMs}ms — total=${totalRows.toLocaleString()}, all-window plates=${aggs.all.size.toLocaleString()}, elapsed=${elapsedS}s`,
    );
    if (rows.length < PAGE_SIZE) {
      console.log("partial page — end of dataset.");
      break;
    }
  }

  // for each window: sort, take top 500, write to redis. also compute percentile buckets from the 'all' window.
  const TTL = 60 * 60 * 26;
  for (const w of WINDOWS) {
    const sorted = [...aggs[w].values()].sort((a, b) => b.count - a.count);
    const leaderboard = sorted.slice(0, 500).map((e, i) => ({
      rank: i + 1,
      plate: e.plate,
      state: e.state,
      violationCount: e.count,
      totalFines: Math.round(e.fines * 100) / 100,
    }));
    await redis.set(`leaderboard:nyc:${w}`, leaderboard, { ex: TTL });
    console.log(`leaderboard:nyc:${w}: ${leaderboard.length} entries, top plate=${leaderboard[0]?.plate ?? "—"} (${leaderboard[0]?.violationCount ?? 0})`);
  }

  // primary leaderboard key (used by /leaderboard/nyc and homepage when no window is selected)
  // mirror the 1-month window so old keys keep working
  const monthly = (await redis.get<unknown>("leaderboard:nyc:1m")) as unknown;
  if (monthly) await redis.set("leaderboard:nyc", monthly, { ex: TTL });

  // percentile buckets derived from the broadest (all) window
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
  await redis.set("percentiles:nyc", percentiles, { ex: TTL });

  const elapsedS = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\ndone in ${elapsedS}s. ${totalRows.toLocaleString()} rows scanned. oldest issue_date in window: ${oldestSeenIso || "—"}.`);
  console.log(`percentile buckets:`, percentiles.buckets);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
