import { ImageResponse } from "@vercel/og";
import { getCity } from "@/lib/cities";
import {
  formatCurrency,
  formatNumber,
  normalizePlate,
  normalizeState,
  ordinalRank,
} from "@/lib/format";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

const PAPER = "#f7f3ec";
const INK = "#0d0a06";
const MUTED = "#5a4e3f";
const ACCENT = "#cf3e1f";
const PLATE_BLUE = "#003a88";

interface Ctx {
  params: { city: string; state: string; plate: string };
}

export async function GET(_req: Request, { params }: Ctx) {
  const city = getCity(params.city);
  const plate = normalizePlate(params.plate);
  const state = normalizeState(params.state);

  let totalViolations = 0;
  let totalFines = 0;
  let rankNum: number | null = null;
  let rankTotal: number | null = null;
  let supported = !!city?.enabled;

  if (city?.enabled && plate && state.length === 2) {
    try {
      const result = await city.lookup(plate, state);
      totalViolations = result.totalViolations;
      totalFines = result.totalFinesIssued;
      if (city.getRank) {
        const r = await city.getRank(result.totalViolations, result.totalFinesIssued);
        if (r) {
          rankNum = r.rank;
          rankTotal = r.total;
        }
      }
    } catch {
      supported = false;
    }
  }

  const cityName = city?.shortName?.toLowerCase() ?? "nyc";

  // ─── headline construction ────────────────────────────────────────────────
  // The most viral framing is the rank sentence. We fall back gracefully if
  // there's no rank yet (data still refreshing) or the plate has no record.
  let kicker: string;
  let headlineMain: string;
  let headlineAccent: string;
  let secondLine: string | null = null;

  if (!supported) {
    kicker = `${cityName} lookups`;
    headlineMain = "coming soon.";
    headlineAccent = "";
  } else if (totalViolations === 0) {
    kicker = "no record on file";
    headlineMain = "a clean";
    headlineAccent = "driver.";
    secondLine = "boring.";
  } else if (rankNum !== null && rankTotal !== null) {
    kicker = `${cityName} dept. of finance · public record`;
    headlineMain = "the";
    headlineAccent = `${ordinalRank(rankNum)} worst`;
    secondLine = `driver in ${cityName}.`;
  } else {
    kicker = `${cityName} dept. of finance · public record`;
    headlineMain = `ticketed`;
    headlineAccent = `${formatNumber(totalViolations)}×`;
    secondLine = `in ${cityName}.`;
  }

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
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif',
          padding: 56,
          position: "relative",
        }}
      >
        {/* ── masthead strip ── */}
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

        {/* ── body grid ── */}
        <div
          style={{
            display: "flex",
            flex: 1,
            paddingTop: 28,
            gap: 36,
          }}
        >
          {/* left column — headline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
                {kicker}
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: 18,
                  fontSize: 96,
                  fontWeight: 900,
                  lineHeight: 0.95,
                  letterSpacing: -3,
                }}
              >
                <span>{headlineMain}</span>
                {headlineAccent ? (
                  <span style={{ color: ACCENT, fontStyle: "italic" }}>
                    {headlineAccent}
                  </span>
                ) : null}
              </div>
              {secondLine ? (
                <div
                  style={{
                    fontSize: 84,
                    fontWeight: 900,
                    lineHeight: 0.95,
                    letterSpacing: -3,
                  }}
                >
                  {secondLine}
                </div>
              ) : null}
            </div>

            {/* footer stat row */}
            {supported && totalViolations > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: 36,
                  marginTop: 24,
                  paddingTop: 18,
                  borderTop: `1px solid ${INK}33`,
                }}
              >
                <StatPair label="tickets" value={formatNumber(totalViolations)} />
                <StatPair
                  label="total fines"
                  value={formatCurrency(totalFines, { compact: true })}
                />
                {rankTotal !== null ? (
                  <StatPair
                    label="of"
                    value={`${formatNumber(rankTotal)} drivers`}
                    accent
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {/* right column — plate frame */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 360,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "14px 32px",
                background: "linear-gradient(180deg,#ffffff 0%,#fff4e3 100%)",
                border: `5px solid ${PLATE_BLUE}`,
                borderRadius: 14,
                transform: "rotate(-2deg)",
                color: PLATE_BLUE,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: 5,
                }}
              >
                {state === "NJ" ? "NEW JERSEY" : state === "NY" ? "NEW YORK" : state.toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: 88,
                  fontWeight: 900,
                  letterSpacing: 6,
                  lineHeight: 1,
                  color: state === "NJ" ? "#0b2545" : PLATE_BLUE,
                }}
              >
                {plate}
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 16,
            marginTop: 12,
            borderTop: `1px solid ${INK}33`,
            fontSize: 14,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          <span>data: nyc open records</span>
          <span style={{ color: INK, fontWeight: 700 }}>worstdriversinnyc.com</span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}

function StatPair({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 36,
          fontWeight: 900,
          color: accent ? ACCENT : INK,
          marginTop: 4,
        }}
      >
        {value}
      </span>
    </div>
  );
}
