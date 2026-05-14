import { PlateLookupResult } from "@/lib/cities/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PlateFrame } from "./PlateFrame";
import { RankBadge } from "./RankBadge";

interface ResultCardProps {
  result: PlateLookupResult;
  topPercent: number;
  cityShortName: string;
}

export function ResultCard({ result, topPercent, cityShortName }: ResultCardProps) {
  return (
    <section className="rounded-2xl border border-border bg-muted/40 p-6 md:p-10">
      <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4">
          <PlateFrame plate={result.plate} state={result.state} />
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              total violations
            </span>
            <span className="stat-hero">{formatNumber(result.totalViolations)}</span>
          </div>
        </div>
        <RankBadge
          topPercent={topPercent}
          city={cityShortName}
          totalViolations={result.totalViolations}
        />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="paid" value={formatNumber(result.totalPaid)} />
        <Stat label="unpaid" value={formatNumber(result.totalUnpaid)} />
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
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`stat-num ${accentCls}`}>{value}</span>
    </div>
  );
}
