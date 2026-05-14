import { NextResponse } from "next/server";
import { refreshNycLeaderboard } from "@/lib/cities/nyc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : new URL(req.url).searchParams.get("secret") || "";

  if (secret && provided !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshNycLeaderboard();
    return NextResponse.json({
      ok: true,
      city: "nyc",
      leaderboardCount: result.leaderboardCount,
      buckets: result.buckets,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
