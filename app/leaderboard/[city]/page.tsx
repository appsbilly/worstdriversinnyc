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
const WINDOW_KICKERS: Record<LeaderboardWindow, string> = {
  "1w": "this week",
  "1m": "this month",
  "1y": "this year",
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
        <div className="eyebrow">{city.shortName}</div>
        <h1 className="display mt-3 text-[clamp(2.5rem,7vw,5rem)]">leaderboard coming soon.</h1>
        <p className="dek mt-4">
          we're working on adding {city.name}. drop your email to be notified.
        </p>
        <div className="mt-6">
          <WaitlistForm city={city.id} />
        </div>
        <Link
          href="/leaderboard/nyc"
          className="mt-8 inline-block text-[11px] uppercase tracking-[0.18em] underline"
        >
          view the nyc leaderboard instead →
        </Link>
      </div>
    );
  }

  const window = parseWindow(searchParams.window);
  let entries: Awaited<ReturnType<typeof city.getLeaderboard>> = [];
  let meta: Awaited<ReturnType<NonNullable<typeof city.getLeaderboardMeta>>> | null = null;
  try {
    entries = await city.getLeaderboard(100, window);
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
      ? `${fmtIso(meta.oldestIssueDate)} – ${fmtIso(meta.newestIssueDate)}`
      : null;

  return (
    <div>
      <section className="border-b border-foreground/15">
        <div className="container py-10 md:py-14">
          <div className="kicker reveal reveal-1">{city.shortName} · the leaderboard</div>
          <h1 className="display mt-4 text-[clamp(3rem,8vw,7rem)] reveal reveal-2">
            the worst drivers,
            <br />
            <span className="italic">{WINDOW_KICKERS[window]}.</span>
          </h1>
          <p className="dek mt-5 max-w-2xl reveal reveal-2">
            ranked by ticket count from nyc's department of finance open-records dataset over the selected window. plates are public records.
          </p>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-4 reveal reveal-3">
            <WindowTabs
              basePath={`/leaderboard/${city.id}`}
              windows={WINDOWS.map((w) => ({ value: w, label: WINDOW_LABELS[w] }))}
              active={window}
            />
            {range ? (
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <span className="opacity-60">data window:</span>{" "}
                <span className="text-foreground normal-case tracking-normal">{range}</span>
                {meta?.rowsScanned ? (
                  <span className="ml-3 opacity-60">· {formatNumber(meta.rowsScanned)} tickets scanned</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <div className="container py-10 md:py-12">
          <div className="reveal reveal-4">
            <Leaderboard entries={entries} city={city.id} />
          </div>
        </div>
      </section>
    </div>
  );
}
