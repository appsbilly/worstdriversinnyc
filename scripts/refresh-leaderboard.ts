/**
 * Refresh the NYC plate leaderboard + percentile buckets in Upstash Redis.
 *
 * Runs from GitHub Actions (or locally) — no Vercel 60s function cap.
 * Paginates the SODA dataset, aggregates plate counts in memory, writes
 * top 500 + percentile buckets to Redis under the same keys the website reads.
 *
 * env vars:
 *   UPSTASH_REDIS_REST_URL       (required)
 *   UPSTASH_REDIS_REST_TOKEN     (required)
 *   NYC_OPEN_DATA_APP_TOKEN      (optional but recommended — raises throttle limit)
 *   ROWS_TARGET                  (optional — default 5,000,000)
 */
import { Redis } from "@upstash/redis";

const SODA_BASE = "https://data.cityofnewyork.us/resource/nc67-uf89.json";
const PAGE_SIZE = 50_000;
const ROWS_TARGET = Number(process.env.ROWS_TARGET || 5_000_000);
const APP_TOKEN = process.env.NYC_OPEN_DATA_APP_TOKEN;
const PAGE_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 4;

type Row = { plate?: string; state?: string; fine_amount?: string };
type Bucket = { plate: string; state: string; count: number; fines: number };

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(offset: number): Promise<Row[]> {
  const url = new URL(SODA_BASE);
  url.searchParams.set("$select", "plate,state,fine_amount");
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
      if (attempt < MAX_RETRIES) {
        await sleep(wait);
      }
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
  console.log(`refresh-leaderboard: targeting ${ROWS_TARGET.toLocaleString()} rows, page size ${PAGE_SIZE.toLocaleString()}`);
  if (APP_TOKEN) console.log("using NYC_OPEN_DATA_APP_TOKEN");

  const buckets = new Map<string, Bucket>();
  let totalRows = 0;
  let pageIndex = 0;

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
    totalRows += rows.length;
    pageIndex += 1;
    const elapsedS = Math.round((Date.now() - startedAt) / 1000);
    console.log(
      `page ${pageIndex}: +${rows.length.toLocaleString()} rows in ${pageMs}ms — total=${totalRows.toLocaleString()}, unique plates=${buckets.size.toLocaleString()}, elapsed=${elapsedS}s`,
    );
    if (rows.length < PAGE_SIZE) {
      console.log("partial page — end of dataset.");
      break;
    }
  }

  // sort all plates by count desc — used for both leaderboard slice and percentile distribution
  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  const leaderboard = sorted.slice(0, 500).map((e, i) => ({
    rank: i + 1,
    plate: e.plate,
    state: e.state,
    violationCount: e.count,
    totalFines: Math.round(e.fines * 100) / 100,
  }));

  const countsAsc = sorted.map((b) => b.count).sort((a, b) => a - b);
  const percentiles = {
    city: "nyc",
    computedAt: new Date().toISOString(),
    totalPlatesObserved: countsAsc.length,
    buckets: {
      p50: Math.max(2, percentile(countsAsc, 50)),
      p75: Math.max(3, percentile(countsAsc, 75)),
      p90: Math.max(5, percentile(countsAsc, 90)),
      p95: Math.max(10, percentile(countsAsc, 95)),
      p99: Math.max(25, percentile(countsAsc, 99)),
    },
  };

  // 26h TTL — slightly longer than the daily run interval so we don't blip empty
  const TTL = 60 * 60 * 26;
  await redis.set("leaderboard:nyc", leaderboard, { ex: TTL });
  await redis.set("percentiles:nyc", percentiles, { ex: TTL });

  const elapsedS = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\ndone in ${elapsedS}s. ${totalRows.toLocaleString()} rows scanned, ${countsAsc.length.toLocaleString()} unique plates.`);
  console.log(`percentile buckets:`, percentiles.buckets);
  console.log(`\ntop 10:`);
  for (const e of leaderboard.slice(0, 10)) {
    console.log(`  ${String(e.rank).padStart(3)}. ${e.plate.padEnd(8)} ${e.state}  ${String(e.violationCount).padStart(5)} tickets  $${e.totalFines.toLocaleString()}`);
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
