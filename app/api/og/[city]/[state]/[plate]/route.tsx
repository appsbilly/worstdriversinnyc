import { ImageResponse } from "@vercel/og";
import { getCity } from "@/lib/cities";
import { formatCurrency, formatNumber, normalizePlate, normalizeState } from "@/lib/format";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

interface Ctx {
  params: { city: string; state: string; plate: string };
}

export async function GET(_req: Request, { params }: Ctx) {
  const city = getCity(params.city);
  const plate = normalizePlate(params.plate);
  const state = normalizeState(params.state);

  let totalViolations = 0;
  let totalFines = 0;
  let totalOutstanding = 0;
  let topPercent = 50;
  let supported = !!city?.enabled;

  if (city?.enabled && plate && state.length === 2) {
    try {
      const result = await city.lookup(plate, state);
      totalViolations = result.totalViolations;
      totalFines = result.totalFinesIssued;
      totalOutstanding = result.totalFinesOutstanding;
      topPercent = await city.getPercentile(result.totalViolations);
    } catch {
      supported = false;
    }
  }

  const cityName = city?.shortName?.toLowerCase() ?? "nyc";
  const heroLabel = supported
    ? totalViolations === 0
      ? "clean record"
      : `top ${topPercent}%`
    : "coming soon";
  const subLabel = supported
    ? totalViolations === 0
      ? "boring."
      : `of ${cityName} drivers`
    : `${cityName} lookups land soon`;

  const accent = "#FF6B35";

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 56,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 22,
            opacity: 0.7,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <div style={{ width: 14, height: 14, backgroundColor: accent }} />
          platerank
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            marginTop: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderRadius: 14,
              border: `5px solid ${accent}`,
              background: "linear-gradient(180deg,#fefefe 0%,#dedede 100%)",
              color: "#0a0a0a",
              padding: "10px 26px",
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 5,
                opacity: 0.8,
              }}
            >
              {state}
            </div>
            <div
              style={{
                fontSize: 68,
                fontWeight: 900,
                letterSpacing: 8,
                lineHeight: 1,
              }}
            >
              {plate}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: 28,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 22,
                opacity: 0.6,
                textTransform: "uppercase",
                letterSpacing: 3,
              }}
            >
              total tickets
            </div>
            <div
              style={{
                fontSize: 132,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: -3,
                marginTop: 4,
              }}
            >
              {formatNumber(totalViolations)}
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 20 }}>
              <Stat label="total fines" value={formatCurrency(totalFines, { compact: true })} />
              <Stat
                label="outstanding"
                value={formatCurrency(totalOutstanding, { compact: true })}
                color={totalOutstanding > 0 ? accent : undefined}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 20,
              border: `4px solid ${accent}`,
              backgroundColor: "rgba(255,107,53,0.1)",
              padding: "22px 30px",
              minWidth: 260,
            }}
          >
            <div
              style={{
                fontSize: 76,
                fontWeight: 900,
                lineHeight: 1,
                color: accent,
                letterSpacing: -2,
              }}
            >
              {heroLabel}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 20,
                letterSpacing: 3,
                textTransform: "uppercase",
                opacity: 0.8,
              }}
            >
              {subLabel}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            fontSize: 18,
            opacity: 0.55,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <span>{cityName} open data</span>
          <span>platerank.com</span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        style={{
          fontSize: 18,
          opacity: 0.6,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 44, fontWeight: 700, color: color || "#fafafa" }}>
        {value}
      </span>
    </div>
  );
}
