import { NextResponse } from "next/server";
import { cacheSet } from "@/lib/cache";
import { getClientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const rl = await rateLimit(`waitlist:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: { email?: string; city?: string };
  try {
    body = (await req.json()) as { email?: string; city?: string };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const city = (body.city || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  if (!city) {
    return NextResponse.json({ error: "missing city" }, { status: 400 });
  }

  // best-effort persistence: stash in redis under a per-city set.
  // delivery to an email destination is configured at the platform level.
  const key = `waitlist:${city}:${email}`;
  await cacheSet(key, { email, city, ts: Date.now() }, 60 * 60 * 24 * 365);

  // optional: forward to destination via a webhook in future iteration
  return NextResponse.json({ ok: true });
}
