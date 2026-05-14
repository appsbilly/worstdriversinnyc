import { PlateSearch } from "@/components/PlateSearch";
import { Leaderboard } from "@/components/Leaderboard";
import { nycAdapter } from "@/lib/cities/nyc";
import Link from "next/link";

export const revalidate = 1800;

function fmtIso(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export default async function HomePage() {
  let top: Awaited<ReturnType<typeof nycAdapter.getLeaderboard>> = [];
  let meta: Awaited<ReturnType<NonNullable<typeof nycAdapter.getLeaderboardMeta>>> | null = null;
  try {
    top = await nycAdapter.getLeaderboard(10, "1m");
  } catch {
    top = [];
  }
  if (nycAdapter.getLeaderboardMeta) {
    try {
      meta = await nycAdapter.getLeaderboardMeta("1m");
    } catch {
      meta = null;
    }
  }
  const range =
    meta?.oldestIssueDate && meta?.newestIssueDate
      ? `${fmtIso(meta.oldestIssueDate)} → ${fmtIso(meta.newestIssueDate)}`
      : null;

  return (
    <div className="container py-10 md:py-16">
      <section className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          public records · open data · no accounts
        </p>
        <h1 className="font-serif text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          look up any nyc plate.
          <br />
          see where it ranks.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          every ticket, every fine, ranked against every other plate in the city. it's
          public data, finally readable.
        </p>
        <div className="mx-auto mt-8 max-w-2xl">
          <PlateSearch size="hero" />
        </div>
      </section>

      <section className="mt-16 md:mt-24">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
              worst drivers · last 30 days
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {range ? <>tickets issued <span className="text-foreground">{range}</span></> : "refreshed daily from nyc open data"}
            </p>
          </div>
          <Link
            href="/leaderboard/nyc"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            full leaderboard →
          </Link>
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
          href="/leaderboard/nyc"
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
      <h3 className="font-serif text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
