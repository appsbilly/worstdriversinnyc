import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "./cache";

let _limiter: Ratelimit | null = null;

export function getRatelimit(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (_limiter) return _limiter;
  _limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(10, "60 s"),
    analytics: false,
    prefix: "rl:lookup",
  });
  return _limiter;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export async function rateLimit(identifier: string): Promise<RateLimitResult> {
  const limiter = getRatelimit();
  if (!limiter) {
    return { success: true, limit: 10, remaining: 10, reset: Date.now() + 60_000 };
  }
  const res = await limiter.limit(identifier);
  return {
    success: res.success,
    limit: res.limit,
    remaining: res.remaining,
    reset: res.reset,
  };
}

export function getClientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}
