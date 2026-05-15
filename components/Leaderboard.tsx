"use client";

import { LeaderboardEntry } from "@/lib/cities/types";
import { anonymizePlate, formatCurrency, formatNumber } from "@/lib/format";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  city: string;
  /** Compact mode: top 10, no pagination. Used on the homepage. */
  compact?: boolean;
  /** Rows per page when not compact. */
  pageSize?: number;
}

export function Leaderboard({
  entries,
  city,
  compact = false,
  pageSize = 25,
}: LeaderboardProps) {
  const [reveal, setReveal] = useState(true);
  const [page, setPage] = useState(1);
  const scrollAnchor = useRef<HTMLDivElement | null>(null);

  // Max ticket count across ALL entries — used to scale the bar widths so the
  // visualization is comparable across pages (page 1's bars don't all max out).
  const maxTickets = useMemo(
    () => entries.reduce((m, e) => Math.max(m, e.violationCount), 1),
    [entries],
  );

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
        leaderboard not yet computed. check back after the next refresh.
      </div>
    );
  }

  const totalPages = compact ? 1 : Math.max(1, Math.ceil(entries.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = compact ? 0 : (current - 1) * pageSize;
  const end = compact ? 10 : start + pageSize;
  const rows = entries.slice(start, end);

  function goto(p: number) {
    setPage(Math.max(1, Math.min(totalPages, p)));
    requestAnimationFrame(() => {
      scrollAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div ref={scrollAnchor} className="rounded-xl border border-border scroll-mt-20">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {compact ? `top ${rows.length} drivers` : `${formatNumber(entries.length)} drivers`} · {city}
        </span>
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {reveal ? "anonymize" : "reveal plates"}
        </button>
      </div>

      <div className="divide-y divide-border">
        {rows.map((e) => {
          const isTop1 = e.rank === 1;
          const isTop3 = e.rank <= 3;
          const barPct = Math.max(2, (e.violationCount / maxTickets) * 100);

          return (
            <div
              key={`${e.state}-${e.plate}-${e.rank}`}
              className="relative isolate"
            >
              {/* Background bar — proportional fill, sits behind the row content */}
              <div
                className={cn(
                  "absolute inset-y-0 left-0 -z-10",
                  isTop1 ? "bg-accent/15" : isTop3 ? "bg-accent/8" : "bg-foreground/[0.04]",
                )}
                style={{ width: `${barPct}%` }}
                aria-hidden
              />
              <div className="relative flex items-center gap-3 px-4 py-3 md:gap-5 md:py-4">
                {/* rank */}
                <div
                  className={cn(
                    "w-10 shrink-0 text-left font-display font-black leading-none tabular md:w-14",
                    isTop1 ? "text-3xl text-accent md:text-4xl" : "text-2xl md:text-3xl",
                    !isTop1 && isTop3 && "text-accent/70",
                    !isTop3 && "text-foreground/70",
                  )}
                >
                  {e.rank}
                </div>

                {/* plate + state suffix */}
                <div className="min-w-0 flex-1 flex items-baseline gap-2">
                  {reveal ? (
                    <Link
                      href={`/lookup/${city}/${e.state}/${e.plate}`}
                      className="font-mono font-bold tracking-[0.12em] text-base md:text-lg hover:text-accent transition-colors truncate"
                    >
                      {e.plate}
                    </Link>
                  ) : (
                    <span className="font-mono font-bold tracking-[0.12em] text-base md:text-lg text-muted-foreground">
                      {anonymizePlate(e.plate)}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground shrink-0">
                    {e.state}
                  </span>
                </div>

                {/* tickets — primary metric, bold */}
                <div
                  className={cn(
                    "shrink-0 text-right tabular font-display font-black",
                    isTop1 ? "text-2xl text-accent md:text-3xl" : "text-xl md:text-2xl",
                    !isTop1 && isTop3 && "text-accent/70",
                  )}
                >
                  {formatNumber(e.violationCount)}
                </div>
                <div className="hidden md:block w-12 text-[10px] uppercase tracking-[0.18em] text-muted-foreground shrink-0">
                  tickets
                </div>

                {/* fines — secondary, smaller */}
                <div className="hidden sm:block shrink-0 text-right tabular text-sm text-muted-foreground w-16 md:w-20">
                  {formatCurrency(e.totalFines, { compact: true })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!compact && totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div>
            showing <span className="text-foreground tabular">#{start + 1}–{Math.min(end, entries.length)}</span> of{" "}
            <span className="text-foreground tabular">{formatNumber(entries.length)}</span>
          </div>
          <PaginationControls current={current} total={totalPages} onChange={goto} />
        </div>
      ) : null}
    </div>
  );
}

function PaginationControls({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (n: number) => void;
}) {
  const pages = buildPageList(current, total);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="rounded-md border border-border px-3 py-1 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
      >
        prev
      </button>
      <div className="hidden sm:flex items-center gap-0.5 px-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground">·</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                "min-w-[1.75rem] px-1 py-1 text-center tabular rounded-md",
                p === current
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className="rounded-md border border-border px-3 py-1 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
      >
        next
      </button>
    </div>
  );
}

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const around = new Set<number>([1, total, current - 1, current, current + 1]);
  if (current <= 4) [2, 3, 4, 5].forEach((n) => around.add(n));
  if (current >= total - 3) [total - 4, total - 3, total - 2, total - 1].forEach((n) => around.add(n));
  const sorted = [...around].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    out.push(n);
    const next = sorted[i + 1];
    if (next !== undefined && next - n > 1) out.push("…");
  }
  return out;
}
