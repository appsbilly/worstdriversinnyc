import { ImageResponse } from "@vercel/og";
import { Redis } from "@upstash/redis";
import { formatNumber } from "@/lib/format";
import { LeaderboardEntry } from "@/lib/cities/types";
import { loadOgFonts } from "@/lib/og-fonts";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;
const PAPER = "#f7f3ec";
const INK = "#0d0a06";
const MUTED = "#5a4e3f";
const ACCENT = "#cf3e1f";

async function getTopPlate(): Promise<LeaderboardEntry | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const redis = new Redis({ url, token });
    const all = await redis.get<LeaderboardEntry[]>("leaderboard:nyc:1m");
    if (Array.isArray(all) && all.length > 0) return all[0];
    const legacy = await redis.get<LeaderboardEntry[]>("leaderboard:nyc");
    if (Array.isArray(legacy) && legacy.length > 0) return legacy[0];
  } catch {
    // silent — fall back to generic copy
  }
  return null;
}

export async function GET() {
  const fonts = await loadOgFonts();
  const lead = await getTopPlate();

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          backgroundColor: PAPER,
          color: INK,
          fontFamily: "Inter",
          padding: 56,
        }}
      >
        {/* masthead */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 14,
            borderBottom: `2px solid ${INK}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            <div style={{ width: 12, height: 12, backgroundColor: ACCENT }} />
            worstdriversinnyc
          </div>
          <div
            style={{
              fontSize: 14,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            public records · open data
          </div>
        </div>

        {/* body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            every ticket · every fine · ranked
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 110,
              fontWeight: 900,
              lineHeight: 0.92,
              letterSpacing: -4,
            }}
          >
            <div style={{ display: "flex" }}>look up any nyc plate.</div>
            <div
              style={{
                display: "flex",
                color: ACCENT,
                fontFamily: "Serif",
                fontStyle: "italic",
              }}
            >
              see where it ranks.
            </div>
          </div>

          {/* live data teaser */}
          {lead ? (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 14,
                marginTop: 8,
                paddingTop: 16,
                borderTop: `1px solid ${INK}33`,
                fontSize: 22,
                color: MUTED,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                today's worst →
              </span>
              <span style={{ color: INK, fontWeight: 700 }}>
                plate {lead.plate} ({lead.state})
              </span>
              <span>has been ticketed</span>
              <span style={{ color: ACCENT, fontWeight: 900 }}>
                {formatNumber(lead.violationCount)}×
              </span>
              <span>in the last month.</span>
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 14,
            borderTop: `1px solid ${INK}33`,
            fontSize: 14,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          <span>data: nyc dept. of finance</span>
          <span style={{ color: INK, fontWeight: 700 }}>worstdriversinnyc.com</span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
    },
  );
}
