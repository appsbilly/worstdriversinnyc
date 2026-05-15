import { PlateLookupResult, RankInfo } from "@/lib/cities/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PlateFrame } from "./PlateFrame";
import { RankBadge } from "./RankBadge";

interface ResultCardProps {
  result: PlateLookupResult;
  rank: RankInfo | null;
  cityShortName: string;
}

export function ResultCard({ result, rank, cityShortName }: ResultCardProps) {
  return (
    <section className="rounded-2xl border border-border bg-muted/40 p-5 md:p-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="flex flex-col gap-4">
          <PlateFrame plate={result.plate} state={result.state} />
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              total violations
            </span>
            <span className="stat-hero">{formatNumber(result.totalViolations)}</span>
          </div>
        </div>
        {/* on mobile the badge spans the full width so it doesn't sit narrow on the left */}
        <RankBadge
          rank={rank?.rank ?? null}
          total={rank?.total ?? null}
          city={cityShortName}
          totalViolations={result.totalViolations}
          className="w-full md:w-auto"
        />
      </div>

      {/* 3 cols on mobile keeps it balanced (3 + 2). 5 cols on desktop. */}
      <div className="mt-8 grid grid-cols-3 gap-4 md:grid-cols-5">
        <Stat label="paid" value={formatNumber(result.totalPaid)} />
        <Stat label="unpaid" value={formatNumber(result.totalUnpaid)} />
        <Stat label="dismissed" value={formatNumber(result.totalDismissed)} />
        <Stat label="total fines" value={formatCurrency(result.totalFinesIssued, { compact: true })} />
        <Stat
          label="outstanding"
          value={formatCurrency(result.totalFinesOutstanding, { compact: true })}
          accent={result.totalFinesOutstanding > 0 ? "danger" : "ok"}
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "danger" | "ok";
}) {
  const accentCls =
    accent === "danger" ? "text-danger" : accent === "ok" ? "text-ok" : "text-foreground";
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground md:text-xs">
        {label}
      </span>
      <span className={`stat-num ${accentCls}`}>{value}</span>
    </div>
  );
}
