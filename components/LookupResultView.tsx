"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Share2 } from "lucide-react";
import { PlateLookupResult, RankInfo, Violation } from "@/lib/cities/types";
import { ResultCard } from "./ResultCard";
import { ViolationTable } from "./ViolationTable";
import { ShareButton } from "./ShareButton";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface LookupResultViewProps {
  result: PlateLookupResult;
  rank: RankInfo | null;
  cityShortName: string;
  cityPortalUrl?: string;
  shareUrl: string;
  tweetSiteUrl: string;
  plate: string;
  state: string;
  tweetText: string;
}

/** "since" date presets — most common case is "since I bought the plate". */
const PRESETS: { value: string; label: string; days: number | null }[] = [
  { value: "all", label: "all time", days: null },
  { value: "5y", label: "5 years", days: 365 * 5 },
  { value: "2y", label: "2 years", days: 365 * 2 },
  { value: "1y", label: "1 year", days: 365 },
  { value: "6m", label: "6 months", days: 30 * 6 },
  { value: "3m", label: "3 months", days: 30 * 3 },
];

export function LookupResultView({
  result,
  rank,
  cityShortName,
  cityPortalUrl,
  shareUrl,
  tweetSiteUrl,
  plate,
  state,
  tweetText,
}: LookupResultViewProps) {
  // Lazily fetched on first filter open. Cached by the browser for an hour
  // (and at the edge for a day) so subsequent opens are instant.
  const [histogram, setHistogram] = useState<Record<string, number> | null>(null);
  const [histogramLoading, setHistogramLoading] = useState(false);

  async function ensureHistogram() {
    if (histogram || histogramLoading) return;
    setHistogramLoading(true);
    try {
      const res = await fetch("/api/rank-histogram");
      if (res.ok) {
        const data = (await res.json()) as Record<string, number>;
        setHistogram(data);
      }
    } catch {
      // silent — rank recompute will show "estimate unavailable" if needed
    } finally {
      setHistogramLoading(false);
    }
  }
  const [preset, setPreset] = useState<string>("all");
  const [customSince, setCustomSince] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shareState, setShareState] = useState<"idle" | "shared">("idle");

  /**
   * Mobile → opens the native OS share sheet (text/iMessage/email/etc).
   * Desktop or unsupported → copies the lookup URL to clipboard.
   */
  async function handleShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "worstdriversinnyc",
          text: tweetText,
          url: shareUrl,
        });
      } catch {
        // user cancelled or share failed — silent
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareState("shared");
      setTimeout(() => setShareState("idle"), 1500);
    } catch {
      // silent
    }
  }

  /**
   * Capture the result card as a PNG and copy it to the clipboard so the user
   * can paste directly into a tweet, message, etc. Falls back to a download if
   * the browser doesn't support image-blob clipboard writes (older Safari, etc).
   *
   * On Safari we wrap the blob in a Promise<Blob> directly so the user-gesture
   * context isn't lost across the async boundary.
   */
  async function copyAsImage() {
    if (!cardRef.current || saveState === "saving") return;
    setSaveState("saving");
    try {
      const { toBlob } = await import("html-to-image");
      const captureOptions = {
        backgroundColor: "#0e0a07",
        pixelRatio: 2,
        cacheBust: true,
        filter: (node: HTMLElement) =>
          !(node instanceof HTMLElement && node.hasAttribute("data-capture-skip")),
      };

      const supportsImageClipboard =
        typeof navigator !== "undefined" &&
        !!navigator.clipboard &&
        typeof ClipboardItem !== "undefined";

      if (supportsImageClipboard) {
        // Pass a blob promise to ClipboardItem so Safari keeps the gesture context.
        const blobPromise = toBlob(cardRef.current, captureOptions).then((b) => {
          if (!b) throw new Error("blob conversion failed");
          return b;
        });
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blobPromise }),
        ]);
      } else {
        // Fallback: download the PNG.
        const blob = await toBlob(cardRef.current, captureOptions);
        if (!blob) throw new Error("blob conversion failed");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `worstdriversinnyc-${plate}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1800);
    } catch (err) {
      console.error("copy card failed:", err);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 1800);
    }
  }

  const filtered = useMemo(() => {
    const isAllTime = preset === "all" && !customSince;
    if (isAllTime) {
      return { result, rank, sinceLabel: null as string | null, isFiltered: false };
    }

    let cutoffMs: number;
    if (customSince) {
      const parsed = Date.parse(customSince);
      if (!Number.isFinite(parsed)) {
        return { result, rank, sinceLabel: null, isFiltered: false };
      }
      cutoffMs = parsed;
    } else {
      const days = PRESETS.find((p) => p.value === preset)?.days ?? 0;
      cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    }

    const filteredViolations = result.violations.filter(
      (v) => Date.parse(v.issueDate) >= cutoffMs,
    );
    const stats = recomputeStats(filteredViolations);
    const filteredRank = histogram
      ? computeRankFromHistogram(stats.totalViolations, histogram)
      : null;

    const filteredResult: PlateLookupResult = {
      ...result,
      ...stats,
      violations: filteredViolations,
      firstViolationDate: filteredViolations.length
        ? filteredViolations[filteredViolations.length - 1]!.issueDate
        : undefined,
      lastViolationDate: filteredViolations.length
        ? filteredViolations[0]!.issueDate
        : undefined,
    };

    return {
      result: filteredResult,
      rank: filteredRank,
      sinceLabel: formatDate(new Date(cutoffMs).toISOString().slice(0, 10)),
      isFiltered: true,
    };
  }, [preset, customSince, result, rank, histogram]);

  return (
    <div>
      <div ref={cardRef}>
        <ResultCard
          result={filtered.result}
          rank={filtered.rank}
          cityShortName={cityShortName}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton
            tweetSiteUrl={tweetSiteUrl}
            plate={plate}
            state={state}
            tweetText={tweetText}
          />
          <button
            type="button"
            onClick={copyAsImage}
            disabled={saveState === "saving"}
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {saveState === "saving" ? "copying…" :
             saveState === "saved" ? "copied!" :
             saveState === "error" ? "try again" :
             "copy image"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="share"
            title="share"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
          >
            {shareState === "shared" ? (
              <Check size={16} strokeWidth={2.25} className="text-ok" />
            ) : (
              <Share2 size={16} strokeWidth={2} />
            )}
          </button>
        </div>
        {cityPortalUrl ? (
          <a
            href={cityPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline decoration-muted-foreground underline-offset-4 hover:text-foreground"
          >
            pay or contest at the official portal →
          </a>
        ) : null}
      </div>

      <p className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        this data reflects the vehicle, not the current owner. plates change hands; this record does not follow people.
      </p>

      {result.ownershipSignals && result.ownershipSignals.length > 0 ? (
        <div className="mt-3 rounded-md border border-warn/30 bg-warn/5 px-4 py-3 text-xs">
          <p className="font-semibold uppercase tracking-[0.18em] text-warn">
            possible ownership change
          </p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {result.ownershipSignals.slice(0, 3).map((s) => (
              <li key={`${s.kind}-${s.detectedAt}`}>
                <span className="text-foreground">{formatDate(s.detectedAt)}</span> · {s.detail}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">
            violations before the most recent signal may belong to a previous owner. use the date
            filter below to view tickets since you owned the plate.
          </p>
        </div>
      ) : null}

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-serif text-2xl font-black tracking-tight">violations</h2>
          <button
            type="button"
            onClick={() => {
              setFilterOpen((o) => !o);
              // kick off histogram fetch the moment the filter is engaged
              ensureHistogram();
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition",
              filtered.isFiltered
                ? "border-accent/40 bg-accent/5 text-accent"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-expanded={filterOpen}
          >
            {filtered.isFiltered ? (
              <>since {filtered.sinceLabel}</>
            ) : (
              <>filter by date</>
            )}
            <ChevronDown
              size={12}
              strokeWidth={2.5}
              className={cn("transition-transform", filterOpen && "rotate-180")}
            />
          </button>
        </div>

        {filterOpen ? (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 md:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  showing tickets from
                </span>
                <div className="flex flex-wrap gap-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        setPreset(p.value);
                        setCustomSince("");
                      }}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs uppercase tracking-wider transition",
                        preset === p.value && !customSince
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="uppercase tracking-wider">since:</span>
                <input
                  type="date"
                  value={customSince}
                  onChange={(e) => {
                    setCustomSince(e.target.value);
                    setPreset("custom");
                  }}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                {customSince ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomSince("");
                      setPreset("all");
                    }}
                    className="text-[10px] uppercase tracking-wider hover:text-foreground"
                  >
                    clear
                  </button>
                ) : null}
              </div>
            </div>
            {filtered.isFiltered ? (
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <span className="text-foreground tabular tracking-normal normal-case">
                  {formatNumber(filtered.result.totalViolations)}
                </span>{" "}
                of {formatNumber(result.totalViolations)} tickets · the rank above is an{" "}
                <span className="italic">estimate</span> based on this window
              </p>
            ) : null}
          </div>
        ) : null}

        {filtered.result.violations.length === 0 ? (
          <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
            {filtered.isFiltered ? "no violations in this window." : "clean record. boring."}
          </div>
        ) : (
          <ViolationTable violations={filtered.result.violations} />
        )}
      </section>
    </div>
  );
}

interface RecomputedStats {
  totalViolations: number;
  totalPaid: number;
  totalUnpaid: number;
  totalDismissed: number;
  totalFinesIssued: number;
  totalFinesPaid: number;
  totalFinesOutstanding: number;
}

function recomputeStats(violations: Violation[]): RecomputedStats {
  let paid = 0;
  let unpaid = 0;
  let dismissed = 0;
  let totalIssued = 0;
  let totalPaid = 0;
  let totalDue = 0;
  for (const v of violations) {
    if (v.status === "paid") paid += 1;
    else if (v.status === "unpaid") unpaid += 1;
    else if (v.status === "dismissed") dismissed += 1;
    totalIssued += v.fineAmount;
    totalPaid += v.amountPaid;
    totalDue += v.amountDue;
  }
  return {
    totalViolations: violations.length,
    totalPaid: paid,
    totalUnpaid: unpaid,
    totalDismissed: dismissed,
    totalFinesIssued: Math.round(totalIssued * 100) / 100,
    totalFinesPaid: Math.round(totalPaid * 100) / 100,
    totalFinesOutstanding: Math.round(totalDue * 100) / 100,
  };
}

function computeRankFromHistogram(
  count: number,
  hist: Record<string, number>,
): RankInfo | null {
  if (count <= 0) return null;
  let rank = 1;
  let total = 0;
  for (const [k, n] of Object.entries(hist)) {
    const c = Number(k);
    const plates = Number(n) || 0;
    total += plates;
    if (c > count) rank += plates;
  }
  if (total === 0) return null;
  return { rank, total };
}
