"use client";

import { LeaderboardEntry } from "@/lib/cities/types";
import { anonymizePlate, formatCurrency, formatNumber } from "@/lib/format";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

  if (entries.length === 0) {
    return (
      <div className="border-t-2 border-b border-foreground/85 px-1 py-12 text-center">
        <p className="font-serif text-2xl italic text-muted-foreground">
          the presses are still warming up.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          leaderboard hasn't been computed yet. check back after the next refresh.
        </p>
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
    <div ref={scrollAnchor} className="border-t-2 border-b border-foreground/85 scroll-mt-20">
      <div className="flex items-center justify-between border-b border-foreground/15 px-1 py-2">
        <span className="eyebrow">
          {compact ? `${rows.length} drivers` : `${formatNumber(entries.length)} drivers`} · {city}
        </span>
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          {reveal ? "anonymize" : "reveal plates"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground border-b border-foreground/15">
              <th className="px-1 py-2 text-left font-medium w-16">rank</th>
              <th className="px-1 py-2 text-left font-medium">plate</th>
              <th className="px-1 py-2 text-left font-medium w-16">state</th>
              <th className="px-1 py-2 text-right font-medium">tickets</th>
              <th className="px-1 py-2 text-right font-medium">fines</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={`${e.state}-${e.plate}-${e.rank}`}
                className="border-b border-foreground/10 last:border-b-0 hover:bg-foreground/[0.03] transition-colors"
              >
                <td className="px-1 py-3 text-left">
                  <span
                    className={cn(
                      "font-serif font-black tabular leading-none",
                      e.rank === 1 ? "text-3xl text-accent" : "text-2xl",
                      e.rank > 1 && e.rank <= 3 && "text-accent/80",
                    )}
                  >
                    {e.rank}
                  </span>
                </td>
                <td className="px-1 py-3 font-mono font-bold tracking-[0.08em] text-base">
                  {reveal ? (
                    <Link
                      href={`/lookup/${city}/${e.state}/${e.plate}`}
                      className="hover:text-accent transition-colors"
                    >
                      {e.plate}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{anonymizePlate(e.plate)}</span>
                  )}
                </td>
                <td className="px-1 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {e.state}
                </td>
                <td
                  className={cn(
                    "px-1 py-3 text-right font-serif font-bold text-xl tabular",
                    e.violationCount > 80 && "text-accent",
                  )}
                >
                  {formatNumber(e.violationCount)}
                </td>
                <td className="px-1 py-3 text-right font-mono text-sm text-muted-foreground tabular">
                  {formatCurrency(e.totalFines, { compact: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!compact && totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/15 px-1 py-3 text-[11px] uppercase tracking-[0.18em]">
          <div className="text-muted-foreground">
            <span className="opacity-60">showing</span>{" "}
            <span className="text-foreground tabular">#{start + 1}–{Math.min(end, entries.length)}</span>{" "}
            <span className="opacity-60">of</span>{" "}
            <span className="text-foreground tabular">{formatNumber(entries.length)}</span>
          </div>
          <PaginationControls
            current={current}
            total={totalPages}
            onChange={goto}
          />
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
  // Build a compact page list: always show first, last, current ±2, with ellipses.
  const pages = buildPageList(current, total);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="border-2 border-foreground/85 px-3 py-1 font-bold text-foreground hover:bg-foreground hover:text-background disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground"
      >
        ← prev
      </button>
      <div className="hidden sm:flex items-center gap-1 px-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground">
              ·
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                "min-w-[2rem] px-1 py-1 text-center tabular font-bold",
                p === current
                  ? "bg-foreground text-background"
                  : "text-foreground/60 hover:text-foreground",
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
        className="border-2 border-foreground/85 px-3 py-1 font-bold text-foreground hover:bg-foreground hover:text-background disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground"
      >
        next →
      </button>
    </div>
  );
}

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: (number | "…")[] = [];
  const around = new Set<number>([1, total, current - 1, current, current + 1]);
  // pad ends so we don't get awkward gaps near 1/total
  if (current <= 4) {
    [2, 3, 4, 5].forEach((n) => around.add(n));
  }
  if (current >= total - 3) {
    [total - 4, total - 3, total - 2, total - 1].forEach((n) => around.add(n));
  }
  const sorted = [...around].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    out.push(n);
    const next = sorted[i + 1];
    if (next !== undefined && next - n > 1) out.push("…");
  }
  return out;
}
