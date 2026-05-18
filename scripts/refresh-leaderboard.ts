/**
 * Refresh NYC plate leaderboards + percentile buckets + rank histogram in Upstash Redis.
 *
 * One pass through the SODA dataset using :id-based keyset pagination (fast at any
 * depth — doesn't slow down like $offset does). Computes four time-windowed
 * leaderboards (1w / 1m / 1y / all) AND maintains an incremental per-plate state
 * across runs so the rank histogram only grows monotonically.
 *
 * The state file (`./state.json.gz` — cached by the GitHub Actions cache action)
 * holds:
 *   { lastProcessedId: string, plates: { "<state>|<plate>": [count, fines] } }
 *
 * Each refresh:
 *   1. loads state from the cache
 *   2. scans SODA in :id DESC, building windowed leaderboards in memory
 *      AND adding rows with :id > lastProcessedId to the plate state
 *   3. computes histogram, fine quantiles, percentiles from the FULL accumulated state
 *   4. writes Redis keys (only on completion)
 *   5. saves state.json.gz for the next run to pick up
 *
 * Result: the "of N drivers" denominator is stable across runs and only grows.
 *
 * env vars:
 *   UPSTASH_REDIS_REST_URL       (required)
 *   UPSTASH_REDIS_REST_TOKEN     (required)
 *   NYC_OPEN_DATA_APP_TOKEN      (optional but recommended)
 *   ROWS_TARGET                  (optional — default 80,000,000)
 *   FLUSH_EVERY_PAGES            (optional — default 100)
 *   STATE_FILE                   (optional — default ./state.json.gz)
 */
import { Redis } from "@upstash/redis";
import { gzipSync, gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SODA_BASE = "https://data.cityofnewyork.us/resource/nc67-uf89.json";
const PAGE_SIZE = 50_000;
// Two targets: bootstrap goes deep (build the full denominator + state),
// incremental still needs to scan back ~1 year so the windowed (1w/1m/1y)
// leaderboards have complete data — they're rebuilt fresh every run from
// the scan, not from persistent state.
const BOOTSTRAP_ROWS_TARGET = Number(process.env.ROWS_TARGET || 80_000_000);
const INCREMENTAL_ROWS_TARGET = Number(
  process.env.INCREMENTAL_ROWS_TARGET || 12_000_000,
);
const FLUSH_EVERY_PAGES = Number(process.env.FLUSH_EVERY_PAGES || 100);
const APP_TOKEN = process.env.NYC_OPEN_DATA_APP_TOKEN;
const PAGE_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 5;
const STATE_FILE = process.env.STATE_FILE || "./state.json.gz";

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
/** Compact per-plate state: [count, fines]. */
type PlateRow = [number, number];

interface PersistedState {
  lastProcessedId: string | null;
  plates: Record<string, PlateRow>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

function isJunkPlate(plate: string, state: string): boolean {
  const p = plate.toUpperCase();
  if (p === "BLANK" || p === "BLANKPLATE" || p === "NONE" || p === "UNKNOWN" || p === "NOPLATE") return true;
  if (state === "99" || state === "XX") return true;
  return false;
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

function loadState(): PersistedState {
  if (!existsSync(STATE_FILE)) {
    console.log(`no existing state at ${STATE_FILE} — bootstrapping from scratch`);
    return { lastProcessedId: null, plates: {} };
  }
  try {
    const buf = readFileSync(STATE_FILE);
    const json = gunzipSync(buf).toString("utf8");
    const parsed = JSON.parse(json) as PersistedState;
    const count = Object.keys(parsed.plates ?? {}).length;
    console.log(`loaded state: ${count.toLocaleString()} plates, cursor=${parsed.lastProcessedId ?? "(none)"}`);
    return parsed;
  } catch (err) {
    console.warn(`failed to read state, bootstrapping:`, err instanceof Error ? err.message : err);
    return { lastProcessedId: null, plates: {} };
  }
}

function saveState(state: PersistedState): void {
  const json = JSON.stringify(state);
  const gz = gzipSync(Buffer.from(json, "utf8"), { level: 6 });
  writeFileSync(STATE_FILE, gz);
  console.log(`saved state: ${Object.keys(state.plates).length.toLocaleString()} plates, ${(gz.byteLength / 1024 / 1024).toFixed(1)} MB gzipped`);
}

interface Meta {
  window: Window;
  computedAt: string;
  oldestIssueDate: string;
  newestIssueDate: string;
  rowsScanned: number;
  uniquePlates: number;
  totalPlatesIndexed: number;
  totalTicketsIndexed: number;
}

async function writeWindows(
  redis: Redis,
  aggs: Record<Window, Map<string, Bucket>>,
  ranges: Record<Window, { min: number; max: number }>,
  state: PersistedState,
  totalRows: number,
  ttlSeconds: number,
  isFinal: boolean,
) {
  // Cumulative metrics from the persisted state (not this-run-only).
  // These are denormalized onto every window's meta so the UI can show
  // "N plates indexed · M tickets" regardless of which window is selected.
  const plateEntries = Object.values(state.plates);
  const totalPlatesIndexed = plateEntries.length;
  let totalTicketsIndexed = 0;
  for (const [count] of plateEntries) totalTicketsIndexed += count;

  // Always flush windowed leaderboards so the page has fresh recent data
  // during a long-running refresh.
  for (const w of WINDOWS) {
    const sorted = [...aggs[w].values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.fines !== a.fines) return b.fines - a.fines;
      return a.plate.localeCompare(b.plate);
    });
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
      totalPlatesIndexed,
      totalTicketsIndexed,
    };
    await redis.set(`leaderboard:nyc:${w}`, leaderboard, { ex: ttlSeconds });
    await redis.set(`leaderboard:nyc:${w}:meta`, meta, { ex: ttlSeconds });
  }
  const monthly = (await redis.get<unknown>("leaderboard:nyc:1m")) as unknown;
  if (monthly) await redis.set("leaderboard:nyc", monthly, { ex: ttlSeconds });

  // Rank-related artefacts derive from the FULL accumulated state, so they're
  // stable across runs. Only write them on the final flush to avoid partial
  // states leaking out mid-refresh.
  if (!isFinal) return;

  // Histogram of plate-count -> # plates at that count (reuses plateEntries from above)
  const histogram: Record<string, number> = {};
  for (const [count] of plateEntries) {
    const k = String(count);
    histogram[k] = (histogram[k] || 0) + 1;
  }
  await redis.set("rank_histogram:nyc", histogram, { ex: ttlSeconds });

  // Per-count fine quantiles for tie-breaking by total fines
  const finesByCount = new Map<number, number[]>();
  for (const [count, fines] of plateEntries) {
    let arr = finesByCount.get(count);
    if (!arr) {
      arr = [];
      finesByCount.set(count, arr);
    }
    arr.push(fines);
  }
  const fineQuantiles: Record<string, number[]> = {};
  for (const [count, arr] of finesByCount) {
    arr.sort((a, b) => a - b);
    const breaks: number[] = new Array(21);
    for (let i = 0; i <= 20; i++) {
      const p = i * 5;
      const idx = Math.min(arr.length - 1, Math.floor((p / 100) * arr.length));
      breaks[i] = Math.round((arr[idx] ?? 0) * 100) / 100;
    }
    fineQuantiles[String(count)] = breaks;
  }
  await redis.set("rank_fine_quantiles:nyc", fineQuantiles, { ex: ttlSeconds });

  // Percentile buckets across the full population
  const allCounts = plateEntries.map(([c]) => c).sort((a, b) => a - b);
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
  // Anchor for window cutoffs. Defaults to "now" but we re-anchor to the
  // dataset's most recent issue_date after fetching the first page, because
  // NYC's open data has a multi-day ingestion lag (latest tickets are usually
  // 3-7 days behind real time). Without this, "1 week" can yield only 1-3 days
  // of actual data when SODA hasn't published the very-recent stuff yet.
  // We clamp to [now - 30 days, now + 1 day] to defend against typo dates.
  let windowAnchor = now;
  const cutoffs: Record<Window, number> = {
    "1w": windowAnchor - 7 * DAY,
    "1m": windowAnchor - 30 * DAY,
    "1y": windowAnchor - 365 * DAY,
    "all": 0,
  };

  // Windowed aggregators — rebuilt fresh every refresh, transient.
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

  // Persisted state — accumulates across refreshes.
  const state = loadState();
  const previousCursor = state.lastProcessedId;
  let highestIdSeen: string | null = null;
  let newPlatesAdded = 0;
  let newTicketsApplied = 0;

  // Bootstrap (no state yet) scans deep; incremental runs scan back ~1 year
  // so the windowed leaderboards have full coverage.
  const ROWS_TARGET = previousCursor === null ? BOOTSTRAP_ROWS_TARGET : INCREMENTAL_ROWS_TARGET;
  const runMode = previousCursor === null ? "bootstrap" : "incremental";

  console.log(`refresh-leaderboard: mode=${runMode}, target=${ROWS_TARGET.toLocaleString()} rows, page=${PAGE_SIZE.toLocaleString()}, keyset pagination via :id`);
  if (APP_TOKEN) console.log("using NYC_OPEN_DATA_APP_TOKEN");
  console.log(`flush leaderboards every ${FLUSH_EVERY_PAGES} pages; rank artefacts on final flush only`);

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

    // On the first page, re-anchor the window cutoffs to the dataset's most
    // recent issue_date. This handles NYC's ingestion lag — if the dataset's
    // freshest tickets are dated 5 days ago, "1 week" should mean "last 7 days
    // of available data", not "[6 days of lag] + [1 day of overlap]".
    if (pageIndex === 0) {
      let datasetMaxMs = 0;
      const tomorrow = now + DAY;
      for (const r of rows) {
        const d = parseSodaDate(r.issue_date);
        if (d > 0 && d <= tomorrow && d > datasetMaxMs) datasetMaxMs = d;
      }
      // Clamp: don't anchor more than 30 days back (in case the dataset is
      // bizarrely stale), and never anchor into the future.
      if (datasetMaxMs > now - 30 * DAY && datasetMaxMs <= now) {
        windowAnchor = datasetMaxMs;
        cutoffs["1w"] = windowAnchor - 7 * DAY;
        cutoffs["1m"] = windowAnchor - 30 * DAY;
        cutoffs["1y"] = windowAnchor - 365 * DAY;
        console.log(
          `window anchor: ${toIsoDay(windowAnchor)} (dataset lag ${Math.round(
            (now - windowAnchor) / DAY,
          )} days)`,
        );
      }
    }

    // Track highest :id from very first page (since order is DESC).
    if (highestIdSeen === null && rows.length > 0) {
      highestIdSeen = rows[0][":id"] ?? null;
    }

    for (const r of rows) {
      if (!r.plate || !r.state) continue;
      if (isJunkPlate(r.plate, r.state)) continue;
      const key = `${r.state}|${r.plate}`;
      const fine = Number(r.fine_amount) || 0;
      const issuedAt = parseSodaDate(r.issue_date);
      const rowId = r[":id"];

      // Windowed aggregator (transient, rebuilt each refresh).
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

      // Persisted state — only add tickets we haven't seen before.
      // Since we scan in :id DESC, anything with :id > previousCursor is new.
      // If previousCursor is null (bootstrap), all rows are new.
      if (rowId && (previousCursor === null || rowId > previousCursor)) {
        const existing = state.plates[key];
        if (existing) {
          existing[0] += 1;
          existing[1] = Math.round((existing[1] + fine) * 100) / 100;
        } else {
          state.plates[key] = [1, Math.round(fine * 100) / 100];
          newPlatesAdded += 1;
        }
        newTicketsApplied += 1;
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
      `p${pageIndex}: +${rows.length.toLocaleString()} in ${pageMs}ms  total=${totalRows.toLocaleString()}  state-plates=${Object.keys(state.plates).length.toLocaleString()}  +new-tickets=${newTicketsApplied.toLocaleString()}  page-dates=${pageOldest}→${pageNewest}  elapsed=${elapsedS}s`,
    );
    if (rows.length < PAGE_SIZE) {
      console.log("partial page — end of dataset.");
      break;
    }

    // NOTE: we deliberately do NOT break when the cursor passes previousCursor.
    // The windowed aggregators (1w/1m/1y) are rebuilt fresh every run from the
    // scan data — so we need to scan back through enough history (~1 year for
    // the 1y window). ROWS_TARGET is set lower on incremental runs to cap this.

    if (pageIndex % FLUSH_EVERY_PAGES === 0) {
      const flushStart = Date.now();
      await writeWindows(redis, aggs, ranges, state, totalRows, TTL, /* isFinal */ false);
      // Persist cursor + plate state to disk every flush so a cancelled run
      // (GH Actions cap, OOM, etc.) doesn't lose hours of bootstrap progress.
      // The actions/cache/save step at job-end picks up whatever is on disk.
      if (highestIdSeen) state.lastProcessedId = highestIdSeen;
      saveState(state);
      console.log(`  ↳ flushed leaderboards to redis (${Date.now() - flushStart}ms)`);
    }
  }

  // Advance the cursor only after a successful scan
  if (highestIdSeen) state.lastProcessedId = highestIdSeen;

  // Final flush: leaderboards + rank histogram + fine quantiles + percentiles
  await writeWindows(redis, aggs, ranges, state, totalRows, TTL, /* isFinal */ true);

  // Save updated state for the next run
  saveState(state);

  const elapsedS = Math.round((Date.now() - startedAt) / 1000);
  const totalPlates = Object.keys(state.plates).length;
  console.log(`\ndone in ${elapsedS}s. ${totalRows.toLocaleString()} rows scanned this run, ${newTicketsApplied.toLocaleString()} new tickets applied, ${newPlatesAdded.toLocaleString()} new plates added.`);
  console.log(`accumulated state: ${totalPlates.toLocaleString()} unique plates total.`);
  for (const w of WINDOWS) {
    const oldest = ranges[w].min === Infinity ? "—" : toIsoDay(ranges[w].min);
    const newest = ranges[w].max === 0 ? "—" : toIsoDay(ranges[w].max);
    console.log(`  ${w}: ${aggs[w].size.toLocaleString()} plates this scan, dates ${oldest} → ${newest}`);
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
