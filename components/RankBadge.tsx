import { cn } from "@/lib/utils";
import { formatNumber, ordinalRank } from "@/lib/format";

interface RankBadgeProps {
  /** 1 = worst driver. Null if no rank could be computed (clean record or data missing). */
  rank: number | null;
  /** Total plates observed (the denominator). */
  total: number | null;
  city: string;
  totalViolations: number;
  className?: string;
}

export function RankBadge({ rank, total, city, totalViolations, className }: RankBadgeProps) {
  if (totalViolations === 0) {
    return (
      <div
        className={cn(
          "inline-flex flex-col items-center justify-center rounded-2xl border-2 px-6 py-5 border-ok bg-ok/5 text-ok",
          className,
        )}
      >
        <span className="font-display font-black text-4xl leading-none md:text-5xl tabular tracking-[-0.02em]">
          no record
        </span>
        <span className="mt-1 text-xs uppercase tracking-widest opacity-80">
          clean. boring.
        </span>
      </div>
    );
  }

  if (rank === null || total === null) {
    return (
      <div
        className={cn(
          "inline-flex flex-col items-center justify-center rounded-2xl border-2 px-6 py-5 border-border text-muted-foreground",
          className,
        )}
      >
        <span className="font-display font-black text-4xl leading-none md:text-5xl tabular tracking-[-0.02em]">—</span>
        <span className="mt-1 text-xs uppercase tracking-widest">rank pending refresh</span>
      </div>
    );
  }

  const pct = rank / total;
  const tier =
    pct <= 0.01 ? "danger" :
    pct <= 0.10 ? "warn" :
    pct <= 0.50 ? "warn" :
    "ok";

  const colorCls =
    tier === "danger" ? "border-danger bg-danger/5 text-danger" :
    tier === "warn"   ? "border-warn bg-warn/5 text-warn" :
                        "border-ok bg-ok/5 text-ok";

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded-2xl border-2 px-6 py-5 text-center",
        colorCls,
        className,
      )}
    >
      <span className="text-xs uppercase tracking-[0.2em] opacity-80">the</span>
      <span className="font-display font-black text-4xl leading-none md:text-5xl tabular tracking-[-0.02em] mt-1">
        {ordinalRank(rank)}
      </span>
      <span className="font-serif italic text-2xl leading-none mt-2 md:text-3xl">
        worst driver
      </span>
      <span className="mt-2 text-[10px] uppercase tracking-[0.22em] opacity-70">
        of {formatNumber(total)} in {city}
      </span>
    </div>
  );
}
