import { PlateSearch } from "@/components/PlateSearch";
import { Leaderboard } from "@/components/Leaderboard";
import { WindowTabs } from "@/components/WindowTabs";
import { PlateFrame } from "@/components/PlateFrame";
import { nycAdapter } from "@/lib/cities/nyc";
import { LeaderboardWindow } from "@/lib/cities/types";
import { formatCurrency, formatNumber, ordinalRank } from "@/lib/format";
import Link from "next/link";

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
      ? `${fmtIso(meta.oldestIssueDate)} – ${fmtIso(meta.newestIssueDate)}`
      : null;

  const lead = top[0] ?? null;

  return (
    <div>
      {/* ──── Hero / front page ──── */}
      <section className="border-b border-foreground/15">
        <div className="container py-8 md:py-12">
          <div className="grid gap-8 md:grid-cols-12 md:gap-12">
            <div className="md:col-span-7 reveal reveal-1">
              <div className="eyebrow">issue {new Date().getFullYear()} · daily edition</div>
              <h1 className="display mt-3 text-[clamp(3rem,9vw,7.5rem)]">
                the worst<br />drivers<br />
                <span className="italic font-serif font-black">in&nbsp;new&nbsp;york.</span>
              </h1>
              <p className="dek mt-5 max-w-xl">
                a public-records leaderboard of every license plate ticketed by the city of new york, ranked. look up any plate, see its full violation history, find out exactly how badly it drives.
              </p>
            </div>
            <aside className="md:col-span-5 md:border-l md:hairline md:pl-10 reveal reveal-2">
              <div className="eyebrow">look up a plate</div>
              <div className="mt-3">
                <PlateSearch size="hero" />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 border-t hairline pt-4 text-xs">
                <div>
                  <div className="eyebrow">records indexed</div>
                  <div className="font-serif text-2xl font-bold mt-1 tabular">
                    {meta?.rowsScanned ? formatNumber(meta.rowsScanned) : "—"}
                  </div>
                </div>
                <div>
                  <div className="eyebrow">unique plates</div>
                  <div className="font-serif text-2xl font-bold mt-1 tabular">
                    {meta?.uniquePlates ? formatNumber(meta.uniquePlates) : "—"}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ──── Lead story ──── */}
      {lead ? (
        <section className="border-b border-foreground/15 bg-foreground text-background">
          <div className="container py-10 md:py-14">
            <div className="grid gap-8 md:grid-cols-12 md:gap-12 items-center">
              <div className="md:col-span-7 reveal reveal-3">
                <div className="kicker kicker--accent">today's worst driver, {WINDOW_KICKERS[window]}</div>
                <h2 className="display mt-4 text-[clamp(2.5rem,7vw,6rem)] text-background">
                  plate <span className="italic">{lead.plate}</span> has been ticketed{" "}
                  <span className="text-accent">{formatNumber(lead.violationCount)}</span> times.
                </h2>
                <p className="dek mt-4 text-background/70">
                  registered in <span className="text-background">{lead.state}</span>. accrued{" "}
                  <span className="text-background">{formatCurrency(lead.totalFines)}</span> in fines.
                  {range ? <> data window <span className="text-background">{range}</span>.</> : null}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/lookup/nyc/${lead.state}/${lead.plate}`}
                    className="inline-flex h-11 items-center bg-accent px-5 text-sm font-bold uppercase tracking-[0.18em] text-accent-foreground hover:bg-accent/90"
                  >
                    open the record →
                  </Link>
                  <Link
                    href={`/leaderboard/nyc?window=${window}`}
                    className="inline-flex h-11 items-center border border-background/40 px-5 text-sm font-bold uppercase tracking-[0.18em] text-background hover:bg-background hover:text-foreground"
                  >
                    full leaderboard
                  </Link>
                </div>
              </div>
              <div className="md:col-span-5 flex md:justify-end reveal reveal-4">
                <div className="rotate-[-1.5deg]">
                  <PlateFrame plate={lead.plate} state={lead.state} className="text-4xl md:text-5xl" />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ──── Leaderboard ──── */}
      <section id="leaderboard" className="border-b border-foreground/15 scroll-mt-16">
        <div className="container py-10 md:py-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
            <div className="reveal reveal-3">
              <div className="kicker">the leaderboard</div>
              <h2 className="display mt-3 text-[clamp(2rem,5vw,4rem)]">
                worst drivers, <span className="italic">{WINDOW_KICKERS[window]}.</span>
              </h2>
              <p className="dek mt-2">
                {range ? (
                  <>tickets issued <span className="text-foreground not-italic">{range}</span></>
                ) : (
                  "refreshing from nyc open data"
                )}
              </p>
            </div>
            <Link
              href={`/leaderboard/nyc?window=${window}`}
              className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              see all 100 →
            </Link>
          </div>
          <div className="mb-5 reveal reveal-4">
            <WindowTabs
              basePath="/"
              windows={WINDOWS.map((w) => ({ value: w, label: WINDOW_LABELS[w] }))}
              active={window}
              hash="leaderboard"
            />
          </div>
          <div className="reveal reveal-5">
            <Leaderboard entries={top} city="nyc" compact />
          </div>
        </div>
      </section>

      {/* ──── Below the fold: feature cards ──── */}
      <section className="container py-12 md:py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            kicker="search"
            title="any plate, any state"
            body="punch in a plate. see every parking and camera violation the city ever issued, with status, fines, and where the ticket was written."
            href="/"
          />
          <FeatureCard
            kicker="ranked"
            title={`${formatNumber(meta?.uniquePlates ?? 0)} drivers, scored`}
            body="competition-style ranking against every other plate in the dataset. #1 is the city's most-ticketed vehicle."
            href={`/leaderboard/nyc?window=${window}`}
          />
          <FeatureCard
            kicker="methodology"
            title="how this works"
            body="data source, refresh cadence, why some plates may be missing, and the legal disclaimer."
            href="/methodology"
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  kicker,
  title,
  body,
  href,
}: {
  kicker: string;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group border-t-2 border-foreground/85 pt-4 transition"
    >
      <div className="eyebrow">{kicker}</div>
      <h3 className="font-serif text-2xl font-black tracking-tight mt-2 group-hover:text-accent transition-colors">
        {title}
      </h3>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{body}</p>
      <span className="mt-3 inline-block text-[11px] uppercase tracking-[0.2em] text-foreground group-hover:text-accent">
        read →
      </span>
    </Link>
  );
}
