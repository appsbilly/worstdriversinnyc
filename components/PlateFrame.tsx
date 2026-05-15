import { cn } from "@/lib/utils";

interface PlateFrameProps {
  plate: string;
  state: string;
  className?: string;
}

interface PlateStyle {
  bg: string;
  text: string;
  border: string;
  headerLabel: string;
  headerColor: string;
  headerItalic?: boolean;
  /** Optional very small footer label rendered under the plate number (e.g. "Garden State"). */
  footerLabel?: string;
}

/**
 * Approximate state-plate styling. Real plates have custom fonts and decorations
 * we can't replicate exactly, but we pick recognizable color schemes for the
 * states that show up most often in NYC ticket data.
 */
const STYLES: Record<string, PlateStyle> = {
  NY: {
    bg: "linear-gradient(180deg,#ffffff 0%,#fff4e3 100%)",
    text: "#003a88",
    border: "#003a88",
    headerLabel: "NEW YORK",
    headerColor: "#003a88",
    footerLabel: "EMPIRE STATE",
  },
  NJ: {
    bg: "linear-gradient(180deg,#fff9cc 0%,#ffe98a 100%)",
    text: "#0b2545",
    border: "#0b2545",
    headerLabel: "NEW JERSEY",
    headerColor: "#0b2545",
    footerLabel: "GARDEN STATE",
  },
  CA: {
    bg: "linear-gradient(180deg,#ffffff 0%,#f1f1f1 100%)",
    text: "#0a1a4a",
    border: "#b91c1c",
    headerLabel: "California",
    headerColor: "#b91c1c",
    headerItalic: true,
  },
  TX: {
    bg: "linear-gradient(180deg,#f8f8f8 0%,#dcdcdc 100%)",
    text: "#1a1a1a",
    border: "#1a1a1a",
    headerLabel: "TEXAS",
    headerColor: "#1a1a1a",
    footerLabel: "THE LONE STAR STATE",
  },
  FL: {
    bg: "linear-gradient(180deg,#ffffff 0%,#f0f0f0 100%)",
    text: "#1a1a1a",
    border: "#cc6600",
    headerLabel: "FLORIDA",
    headerColor: "#cc6600",
    footerLabel: "SUNSHINE STATE",
  },
  PA: {
    bg: "linear-gradient(180deg,#fffce0 0%,#fff099 100%)",
    text: "#0a3d8f",
    border: "#0a3d8f",
    headerLabel: "PENNSYLVANIA",
    headerColor: "#0a3d8f",
  },
  CT: {
    bg: "linear-gradient(180deg,#ffffff 0%,#e6eef7 100%)",
    text: "#0a2d6b",
    border: "#0a2d6b",
    headerLabel: "CONNECTICUT",
    headerColor: "#0a2d6b",
    footerLabel: "CONSTITUTION STATE",
  },
  MA: {
    bg: "linear-gradient(180deg,#ffffff 0%,#f0f0f0 100%)",
    text: "#b91c1c",
    border: "#1a1a1a",
    headerLabel: "MASSACHUSETTS",
    headerColor: "#b91c1c",
    footerLabel: "THE SPIRIT OF AMERICA",
  },
  IL: {
    bg: "linear-gradient(180deg,#ffffff 0%,#fff8dc 100%)",
    text: "#0a3d8f",
    border: "#cc0000",
    headerLabel: "ILLINOIS",
    headerColor: "#cc0000",
    footerLabel: "LAND OF LINCOLN",
  },
  VA: {
    bg: "linear-gradient(180deg,#ffffff 0%,#f0f0f0 100%)",
    text: "#0a3d8f",
    border: "#0a3d8f",
    headerLabel: "VIRGINIA",
    headerColor: "#0a3d8f",
  },
  MD: {
    bg: "linear-gradient(180deg,#ffffff 0%,#f0f0f0 100%)",
    text: "#1a1a1a",
    border: "#1a1a1a",
    headerLabel: "MARYLAND",
    headerColor: "#cc0000",
  },
  DC: {
    bg: "linear-gradient(180deg,#ffffff 0%,#f0f0f0 100%)",
    text: "#1a1a1a",
    border: "#cc0000",
    headerLabel: "WASHINGTON, D.C.",
    headerColor: "#cc0000",
    footerLabel: "TAXATION WITHOUT REPRESENTATION",
  },
  IN: {
    bg: "linear-gradient(180deg,#fff8dc 0%,#fff099 100%)",
    text: "#0a3d8f",
    border: "#0a3d8f",
    headerLabel: "INDIANA",
    headerColor: "#0a3d8f",
    footerLabel: "HOOSIER STATE",
  },
};

const DEFAULT_STYLE: PlateStyle = {
  bg: "linear-gradient(180deg,#fefefe 0%,#ececec 100%)",
  text: "#111111",
  border: "#111111",
  headerLabel: "",
  headerColor: "#111111",
};

export function PlateFrame({ plate, state, className }: PlateFrameProps) {
  const style = STYLES[state.toUpperCase()] ?? { ...DEFAULT_STYLE, headerLabel: state.toUpperCase() };

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center rounded-lg border-[3px] px-5 py-2 shadow-sm select-none",
        className,
      )}
      style={{
        borderColor: style.border,
        backgroundImage: style.bg,
      }}
    >
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.18em]",
          style.headerItalic && "italic font-serif text-base normal-case tracking-tight",
        )}
        style={{ color: style.headerColor }}
      >
        {style.headerLabel || state.toUpperCase()}
      </span>
      <span
        className="font-mono text-3xl font-black tracking-[0.16em] leading-tight md:text-4xl"
        style={{ color: style.text }}
      >
        {plate}
      </span>
      {style.footerLabel ? (
        <span
          className="text-[7px] font-bold uppercase tracking-[0.22em] -mt-0.5"
          style={{ color: style.headerColor }}
        >
          {style.footerLabel}
        </span>
      ) : null}
    </div>
  );
}
