import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

export async function GET() {
  const accent = "#dc4a1d";
  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 64,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 22,
            opacity: 0.75,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <div style={{ width: 14, height: 14, backgroundColor: accent }} />
          worstdriversinnyc
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: -4,
              maxWidth: 1000,
            }}
          >
            look up any nyc plate.
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: -4,
              color: accent,
            }}
          >
            see where it ranks.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            fontSize: 20,
            opacity: 0.6,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <span>every ticket. every fine. ranked.</span>
          <span>worstdriversinnyc.com</span>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
