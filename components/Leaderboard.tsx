"use client";

import { LeaderboardEntry } from "@/lib/cities/types";
import { anonymizePlate, formatCurrency, formatNumber } from "@/lib/format";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  city: string;
  compact?: boolean;
}

export function Leaderboard({ entries, city, compact = false }: LeaderboardProps) {
  const [reveal, setReveal] = useState(true);
  const rows = compact ? entries.slice(0, 10) : entries;

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

  return (
    <div className="border-t-2 border-b border-foreground/85">
      <div className="flex items-center justify-between border-b border-foreground/15 px-1 py-2">
        <span className="eyebrow">{rows.length} drivers · {city}</span>
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
              <th className="px-1 py-2 text-left font-medium w-12">rank</th>
              <th className="px-1 py-2 text-left font-medium">plate</th>
              <th className="px-1 py-2 text-left font-medium w-16">state</th>
              <th className="px-1 py-2 text-right font-medium">tickets</th>
              <th className="px-1 py-2 text-right font-medium">fines</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, idx) => (
              <tr
                key={`${e.state}-${e.plate}`}
                className="border-b border-foreground/10 last:border-b-0 hover:bg-foreground/[0.03] transition-colors"
              >
                <td className="px-1 py-3 text-left">
                  <span
                    className={cn(
                      "font-serif font-black text-2xl tabular leading-none",
                      idx === 0 && "text-accent",
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
    </div>
  );
}
