import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (_redis) return _redis;
  _redis = new Redis({ url, token });
  return _redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const value = await r.get<T>(key);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, value, { ex: ttlSeconds });
  } catch {
    // silent — cache is best-effort
  }
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch {
    // silent
  }
}

export const TTL = {
  LOOKUP: 60 * 60 * 24, // 24h
  LEADERBOARD: 60 * 60 * 6, // 6h
  PERCENTILES: 60 * 60 * 24, // 24h
} as const;
