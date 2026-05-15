import { Leaderboard } from "@/components/Leaderboard";
import { WindowTabs } from "@/components/WindowTabs";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getCity } from "@/lib/cities";
import { LeaderboardWindow } from "@/lib/cities/types";
import { formatNumber } from "@/lib/format";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 1800;

interface PageProps {
  params: { city: string };
  searchParams: { window?: string };
}

const WINDOWS: LeaderboardWindow[] = ["1w", "1m", "1y", "all"];
const WINDOW_LABELS: Record<LeaderboardWindow, string> = {
  "1w": "1 week",
  "1m": "1 month",
  "1y": "1 year",
  "all": "all time",
};

function parseWindow(input: string | undefined): LeaderboardWindow {
  if (input && (WINDOWS as string[]).includes(input)) return input as LeaderboardWindow;
  return "1m";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const city = getCity(params.city);
  if (!city) return { title: "leaderboard" };
  return {
    title: `${city.shortName} leaderboard`,
    description: `the most-ticketed plates in ${city.name}, refreshed daily.`,
  };
}

export default async function LeaderboardPage({ params, searchParams }: PageProps) {
  const city = getCity(params.city);
  if (!city) notFound();

  if (!city.enabled) {
    return (
      <div className="container max-w-xl py-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {city.shortName}
        </p>
        <h1 className="mt-2 font-serif text-4xl font-black tracking-tight">leaderboard coming soon.</h1>
        <p className="mt-3 text-muted-foreground">
          we're working on adding {city.name}. drop your email to be notified.
        </p>
        <div className="mt-6">
          <WaitlistForm city={city.id} />
        </div>
        <Link href="/leaderboard/nyc" className="mt-8 inline-block text-sm underline">
          view the nyc leaderboard instead →
        </Link>
      </div>
    );
  }

  const window = parseWindow(searchParams.window);
  let entries: Awaited<ReturnType<typeof city.getLeaderboard>> = [];
  let meta: Awaited<ReturnType<NonNullable<typeof city.getLeaderboardMeta>>> | null = null;
  try {
    entries = await city.getLeaderboard(500, window);
  } catch {
    entries = [];
  }
  if (city.getLeaderboardMeta) {
    try {
      meta = await city.getLeaderboardMeta(window);
    } catch {
      meta = null;
    }
  }

  function fmtIso(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
  }
  const range =
    meta?.oldestIssueDate && meta?.newestIssueDate
      ? `${fmtIso(meta.oldestIssueDate)} → ${fmtIso(meta.newestIssueDate)}`
      : null;

  return (
    <div className="container py-10 max-w-5xl">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {city.shortName} · leaderboard
      </p>
      <h1 className="mt-2 font-serif text-4xl font-black tracking-tight md:text-5xl">
        the worst drivers in {city.shortName.toLowerCase()}.
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        ranked by ticket count from nyc's open-data feed over the selected window.
      </p>
      <div className="mt-6">
        <WindowTabs
          basePath={`/leaderboard/${city.id}`}
          windows={WINDOWS.map((w) => ({ value: w, label: WINDOW_LABELS[w] }))}
          active={window}
        />
      </div>
      {range ? (
        <p className="mt-3 text-xs text-muted-foreground">
          data window: <span className="text-foreground">{range}</span>
          {meta?.rowsScanned ? ` · ${formatNumber(meta.rowsScanned)} tickets scanned` : null}
        </p>
      ) : null}
      <div className="mt-6">
        <Leaderboard entries={entries} city={city.id} />
      </div>
    </div>
  );
}
