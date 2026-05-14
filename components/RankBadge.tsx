import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

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
        <span className="font-serif text-4xl font-bold leading-none md:text-5xl">
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
        <span className="font-serif text-4xl font-bold leading-none md:text-5xl">—</span>
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
        "inline-flex flex-col items-center justify-center rounded-2xl border-2 px-6 py-5",
        colorCls,
        className,
      )}
    >
      <span className="text-xs uppercase tracking-widest opacity-80">rank</span>
      <span className="font-serif text-4xl font-bold leading-none md:text-5xl">
        #{formatNumber(rank)}
      </span>
      <span className="mt-1 text-xs uppercase tracking-widest opacity-80">
        of {formatNumber(total)} {city} drivers
      </span>
    </div>
  );
}
