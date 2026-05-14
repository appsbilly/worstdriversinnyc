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
  const [reveal, setReveal] = useState(false);
  const rows = compact ? entries.slice(0, 10) : entries;

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
        leaderboard not yet computed. check back after the next cron run.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          top {rows.length} plates · {city}
        </span>
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {reveal ? "anonymize" : "reveal plates"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">plate</th>
              <th className="px-4 py-2 font-medium">state</th>
              <th className="px-4 py-2 text-right font-medium">tickets</th>
              <th className="px-4 py-2 text-right font-medium">fines</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={`${e.state}-${e.plate}`} className="border-t border-border">
                <td className="px-4 py-2 tabular-nums text-muted-foreground">{e.rank}</td>
                <td className="px-4 py-2 font-mono font-bold tracking-wider">
                  {reveal ? (
                    <Link
                      href={`/lookup/${city}/${e.state}/${e.plate}`}
                      className="hover:underline"
                    >
                      {e.plate}
                    </Link>
                  ) : (
                    anonymizePlate(e.plate)
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{e.state}</td>
                <td
                  className={cn(
                    "px-4 py-2 text-right tabular-nums font-semibold",
                    e.violationCount > 100 && "text-danger",
                  )}
                >
                  {formatNumber(e.violationCount)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
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
