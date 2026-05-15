"use client";

import { Violation } from "@/lib/cities/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface ViolationTableProps {
  violations: Violation[];
  pageSize?: number;
}

type Filter = "all" | "paid" | "unpaid" | "dismissed";

export function ViolationTable({ violations, pageSize = 25 }: ViolationTableProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (filter === "all") return violations;
    return violations.filter((v) => v.status === filter);
  }, [violations, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  return (
    <div className="border-t-2 border-b border-foreground/85">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/15 px-1 py-2">
        <div className="flex gap-1">
          {(["all", "paid", "unpaid", "dismissed"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={cn(
                "px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] font-medium transition",
                filter === f
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "violation" : "violations"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground border-b border-foreground/15">
              <th className="px-1 py-2 text-left font-medium w-12">#</th>
              <th className="px-1 py-2 text-left font-medium">date</th>
              <th className="px-1 py-2 text-left font-medium">violation</th>
              <th className="px-1 py-2 text-left font-medium">location</th>
              <th className="px-1 py-2 text-right font-medium">fine</th>
              <th className="px-1 py-2 text-right font-medium">due</th>
              <th className="px-1 py-2 text-left font-medium">status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-1 py-12 text-center">
                  <p className="font-serif text-xl italic text-muted-foreground">
                    no violations match this filter.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((v, idx) => (
                <tr
                  key={v.id}
                  className="border-b border-foreground/10 last:border-b-0 hover:bg-foreground/[0.03] transition-colors"
                >
                  <td className="px-1 py-3 align-top text-[11px] tabular text-muted-foreground">
                    {start + idx + 1}
                  </td>
                  <td className="px-1 py-3 align-top whitespace-nowrap text-sm tabular">
                    {formatDate(v.issueDate)}
                  </td>
                  <td className="px-1 py-3 align-top text-sm">{v.violationType}</td>
                  <td className="px-1 py-3 align-top text-sm text-muted-foreground">
                    {v.location || "—"}
                  </td>
                  <td className="px-1 py-3 align-top text-right tabular font-serif font-bold">
                    {formatCurrency(v.fineAmount)}
                  </td>
                  <td
                    className={cn(
                      "px-1 py-3 align-top text-right tabular font-serif font-bold",
                      v.amountDue > 0 ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    {formatCurrency(v.amountDue)}
                  </td>
                  <td className="px-1 py-3 align-top">
                    <StatusPill status={v.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-foreground/15 px-1 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>
            page {current} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current === 1}
              className="border-2 border-foreground/85 px-3 py-1 font-bold text-foreground hover:bg-foreground hover:text-background disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground"
            >
              ← prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={current === totalPages}
              className="border-2 border-foreground/85 px-3 py-1 font-bold text-foreground hover:bg-foreground hover:text-background disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground"
            >
              next →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: Violation["status"] }) {
  const map: Record<Violation["status"], { label: string; cls: string }> = {
    paid:       { label: "paid",      cls: "border-ok/40 bg-ok/8 text-ok" },
    unpaid:     { label: "unpaid",    cls: "border-accent/40 bg-accent/8 text-accent" },
    in_dispute: { label: "dispute",   cls: "border-warn/40 bg-warn/10 text-warn" },
    dismissed:  { label: "dismissed", cls: "border-foreground/20 bg-foreground/[0.04] text-muted-foreground" },
    unknown:    { label: "—",         cls: "border-foreground/20 text-muted-foreground" },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] font-bold", cls)}>
      {label}
    </span>
  );
}
