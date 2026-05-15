import { PlateLookupResult, RankInfo } from "@/lib/cities/types";
import { formatCurrency, formatDate, formatNumber, ordinalRank } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlateFrame } from "./PlateFrame";

interface ResultCardProps {
  result: PlateLookupResult;
  rank: RankInfo | null;
  cityShortName: string;
}

export function ResultCard({ result, rank, cityShortName }: ResultCardProps) {
  const hasRank = rank && rank.total > 0 && result.totalViolations > 0;
  const clean = result.totalViolations === 0;
  const pct = hasRank ? rank.rank / rank.total : 1;
  const tier =
    !hasRank || clean ? "neutral"
    : pct <= 0.01 ? "danger"
    : pct <= 0.10 ? "warn"
    : pct <= 0.50 ? "warn"
    : "ok";
  const accentText =
    tier === "danger" ? "text-danger"
    : tier === "warn" ? "text-accent"
    : tier === "ok" ? "text-ok"
    : "text-foreground";

  return (
    <section className="rounded-2xl border border-border bg-muted/40 p-5 md:p-10">
      {/* top: plate frame + small date metadata strip */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PlateFrame plate={result.plate} state={result.state} />
        {result.firstViolationDate ? (
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground md:text-right">
            <span className="opacity-60">on file</span>{" "}
            <span className="text-foreground tracking-normal normal-case">
              {formatDate(result.firstViolationDate)}
              {result.lastViolationDate && result.lastViolationDate !== result.firstViolationDate
                ? ` – ${formatDate(result.lastViolationDate)}`
                : ""}
            </span>
          </div>
        ) : null}
      </div>

      {/* hero: rank as the story (or clean state) */}
      <div className="mt-8 md:mt-10">
        {clean ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              no record on file
            </p>
            <p className="mt-2 font-display text-5xl font-black leading-[0.95] tracking-[-0.03em] md:text-7xl text-ok">
              a clean driver.
            </p>
            <p className="mt-2 font-serif italic text-xl text-muted-foreground md:text-2xl">
              boring, but admirable.
            </p>
          </>
        ) : hasRank ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              the
            </p>
            <p
              className={cn(
                "mt-1 font-display font-black leading-[0.9] tracking-[-0.035em] tabular",
                accentText,
              )}
              style={{ fontSize: "clamp(3rem, 10vw, 7.5rem)" }}
            >
              {ordinalRank(rank.rank)}
            </p>
            <p className="mt-2 font-serif italic text-2xl tracking-tight md:text-4xl">
              worst driver in {cityShortName}.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              of {formatNumber(rank.total)} ranked
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              ticketed
            </p>
            <p
              className="mt-1 font-display font-black leading-[0.9] tracking-[-0.035em] tabular"
              style={{ fontSize: "clamp(3rem, 10vw, 7.5rem)" }}
            >
              {formatNumber(result.totalViolations)}×
            </p>
            <p className="mt-2 font-serif italic text-2xl tracking-tight md:text-4xl">
              in {cityShortName}.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              rank refreshing
            </p>
          </>
        )}
      </div>

      {/* stats grid */}
      <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6 md:mt-10 md:grid-cols-5 md:pt-8">
        <Stat label="violations" value={formatNumber(result.totalViolations)} />
        <Stat label="paid" value={formatNumber(result.totalPaid)} />
        <Stat label="unpaid" value={formatNumber(result.totalUnpaid)} accent={result.totalUnpaid > 0 ? "danger" : undefined} />
        <Stat label="dismissed" value={formatNumber(result.totalDismissed)} />
        <Stat
          label="total fines"
          value={formatCurrency(result.totalFinesIssued, { compact: true })}
        />
      </div>

      {/* outstanding (only when relevant) */}
      {result.totalFinesOutstanding > 0 ? (
        <div className="mt-4 flex items-baseline justify-between rounded-md border border-danger/30 bg-danger/5 px-4 py-3">
          <span className="text-[11px] uppercase tracking-[0.22em] text-danger/80">
            outstanding balance
          </span>
          <span className="font-display text-2xl font-black text-danger tabular">
            {formatCurrency(result.totalFinesOutstanding)}
          </span>
        </div>
      ) : null}
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
      <span className={cn("font-serif text-2xl font-bold tracking-tight md:text-4xl tabular", accentCls)}>
        {value}
      </span>
    </div>
  );
}
