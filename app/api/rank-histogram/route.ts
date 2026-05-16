import { NextResponse } from "next/server";
import { nycAdapter } from "@/lib/cities/nyc";

export const runtime = "nodejs";

/**
 * Serve the all-time rank histogram for client-side rank-recompute when a user
 * applies the date filter on a lookup page. The histogram refreshes once a day
 * via the GH Actions cron, so cache aggressively at the edge + in the browser.
 *
 * Splitting this out from the lookup page render saves ~50KB of JSON per page
 * load for the 90%+ of users who never engage the filter.
 */
export async function GET() {
  const hist = nycAdapter.getRankHistogram
    ? await nycAdapter.getRankHistogram()
    : null;
  if (!hist) {
    return NextResponse.json(
      { error: "histogram not yet computed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(hist, {
    headers: {
      // edge cache for 24h; browser cache for 1h. histogram updates daily.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
