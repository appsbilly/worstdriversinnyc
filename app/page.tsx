import { PlateSearch } from "@/components/PlateSearch";
import { Leaderboard } from "@/components/Leaderboard";
import { WindowTabs } from "@/components/WindowTabs";
import { nycAdapter } from "@/lib/cities/nyc";
import { LeaderboardWindow } from "@/lib/cities/types";
import Link from "next/link";

const WINDOWS: LeaderboardWindow[] = ["1w", "1m", "1y", "all"];
const WINDOW_LABELS: Record<LeaderboardWindow, string> = {
  "1w": "1 week",
  "1m": "1 month",
  "1y": "1 year",
  "all": "all time",
};
const WINDOW_HEADLINES: Record<LeaderboardWindow, string> = {
  "1w": "worst drivers · last 7 days",
  "1m": "worst drivers · last 30 days",
  "1y": "worst drivers · last year",
  "all": "worst drivers · all time",
};

function parseWindow(input: string | undefined): LeaderboardWindow {
  if (input && (WINDOWS as string[]).includes(input)) return input as LeaderboardWindow;
  return "1m";
}

function fmtIso(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

interface PageProps {
  searchParams: { window?: string };
}

export default async function HomePage({ searchParams }: PageProps) {
  const window = parseWindow(searchParams.window);

  let top: Awaited<ReturnType<typeof nycAdapter.getLeaderboard>> = [];
  let meta: Awaited<ReturnType<NonNullable<typeof nycAdapter.getLeaderboardMeta>>> | null = null;
  try {
    top = await nycAdapter.getLeaderboard(10, window);
  } catch {
    top = [];
  }
  if (nycAdapter.getLeaderboardMeta) {
    try {
      meta = await nycAdapter.getLeaderboardMeta(window);
    } catch {
      meta = null;
    }
  }
  const range =
    meta?.oldestIssueDate && meta?.newestIssueDate
      ? `${fmtIso(meta.oldestIssueDate)} → ${fmtIso(meta.newestIssueDate)}`
      : null;

  return (
    <div className="container py-8 md:py-16">
      <section className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:text-xs">
          public records · open data · no accounts
        </p>
        <h1 className="font-serif text-4xl font-black leading-[1.04] tracking-[-0.025em] sm:text-5xl md:text-7xl">
          look up any nyc plate.
          <br />
          see where it ranks.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:mt-5 md:text-lg">
          every ticket, every fine, ranked against every other plate in the city.
        </p>
        <div className="mx-auto mt-6 max-w-2xl md:mt-8">
          <PlateSearch size="hero" />
        </div>
      </section>

      <section id="leaderboard" className="mt-12 scroll-mt-16 md:mt-24">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-black tracking-tight md:text-4xl">
              {WINDOW_HEADLINES[window]}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">
              {range ? (
                <>tickets issued <span className="text-foreground">{range}</span></>
              ) : (
                "refreshed daily from nyc open data"
              )}
            </p>
          </div>
          <Link
            href={`/leaderboard/nyc?window=${window}`}
            className="text-xs text-muted-foreground hover:text-foreground self-start md:self-auto md:text-sm"
          >
            full leaderboard →
          </Link>
        </div>
        <div className="mb-4">
          <WindowTabs
            basePath="/"
            windows={WINDOWS.map((w) => ({ value: w, label: WINDOW_LABELS[w] }))}
            active={window}
            hash="leaderboard"
          />
        </div>
        <Leaderboard entries={top} city="nyc" compact />
      </section>

      <section className="mt-16 grid gap-4 md:mt-24 md:grid-cols-3">
        <FeatureCard
          title="search a fleet"
          body="tlc, nypd, sanitation, congressional plates. drop in a prefix or known plate."
          href="/leaderboard/nyc"
        />
        <FeatureCard
          title="view full leaderboard"
          body="top 100 worst drivers in the city, refreshed every 24 hours."
          href={`/leaderboard/nyc?window=${window}`}
        />
        <FeatureCard
          title="how this works"
          body="what we use, what we don't, and why your plate might be missing."
          href="/methodology"
        />
      </section>
    </div>
  );
}

function FeatureCard({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border p-5 transition hover:border-foreground/50"
    >
      <h3 className="font-serif text-xl font-black tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
