import { cn } from "@/lib/utils";

interface RankBadgeProps {
  /** percent of plates worse-or-equal. Lower number = worse driver. */
  topPercent: number;
  city: string;
  totalViolations: number;
  className?: string;
}

export function RankBadge({ topPercent, city, totalViolations, className }: RankBadgeProps) {
  const isTopTier = topPercent <= 10;
  const isModerate = topPercent <= 50;
  const label = totalViolations === 0
    ? "no record"
    : `top ${topPercent}%`;
  const sub = totalViolations === 0
    ? "clean record. boring."
    : `of ${city} drivers`;

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded-2xl border-2 px-6 py-5",
        isTopTier && "border-danger bg-danger/5 text-danger",
        !isTopTier && isModerate && "border-warn bg-warn/5 text-warn",
        !isModerate && "border-ok bg-ok/5 text-ok",
        className,
      )}
    >
      <span className="font-serif text-4xl font-bold leading-none md:text-5xl">{label}</span>
      <span className="mt-1 text-xs uppercase tracking-widest opacity-80">{sub}</span>
    </div>
  );
}
