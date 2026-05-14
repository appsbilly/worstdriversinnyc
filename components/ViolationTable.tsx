"use client";

import { Violation } from "@/lib/cities/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface ViolationTableProps {
  violations: Violation[];
  pageSize?: number;
}

type Filter = "all" | "paid" | "unpaid";

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
    <div className="rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex gap-1">
          {(["all", "paid", "unpaid"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1 text-xs uppercase tracking-wider transition",
                filter === f
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "violation" : "violations"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">date</th>
              <th className="px-4 py-2 font-medium">type</th>
              <th className="px-4 py-2 font-medium">location</th>
              <th className="px-4 py-2 text-right font-medium">fine</th>
              <th className="px-4 py-2 text-right font-medium">due</th>
              <th className="px-4 py-2 font-medium">status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  no violations match this filter.
                </td>
              </tr>
            ) : (
              rows.map((v) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="px-4 py-2 whitespace-nowrap">{formatDate(v.issueDate)}</td>
                  <td className="px-4 py-2">{v.violationType}</td>
                  <td className="px-4 py-2 text-muted-foreground">{v.location || "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(v.fineAmount)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right tabular-nums",
                      v.amountDue > 0 && "text-danger",
                    )}
                  >
                    {formatCurrency(v.amountDue)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill status={v.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            page {current} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current === 1}
              className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
            >
              prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={current === totalPages}
              className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
            >
              next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: Violation["status"] }) {
  const map: Record<Violation["status"], { label: string; cls: string }> = {
    paid: { label: "paid", cls: "bg-ok/10 text-ok" },
    unpaid: { label: "unpaid", cls: "bg-danger/10 text-danger" },
    in_dispute: { label: "dispute", cls: "bg-warn/10 text-warn" },
    dismissed: { label: "dismissed", cls: "bg-muted text-muted-foreground" },
    unknown: { label: "—", cls: "bg-muted text-muted-foreground" },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider", cls)}>
      {label}
    </span>
  );
}
