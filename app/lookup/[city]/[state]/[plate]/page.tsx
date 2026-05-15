import { ShareButton } from "@/components/ShareButton";
import { ViolationTable } from "@/components/ViolationTable";
import { WaitlistForm } from "@/components/WaitlistForm";
import { PlateFrame } from "@/components/PlateFrame";
import { getCity } from "@/lib/cities";
import {
  CityNotYetSupportedError,
  InvalidPlateError,
  PlateLookupResult,
  RankInfo,
  UpstreamApiError,
} from "@/lib/cities/types";
import {
  formatCurrency,
  formatNumber,
  isValidPlate,
  normalizePlate,
  normalizeState,
  ordinalRank,
} from "@/lib/format";
import { cn, getSiteUrl } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { city: string; state: string; plate: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const city = getCity(params.city);
  if (!city) return { title: "lookup" };
  const plate = normalizePlate(params.plate);
  const state = normalizeState(params.state);
  const ogUrl = `/api/og/${city.id}/${state}/${plate}`;
  return {
    title: `${plate} (${state}) · ${city.shortName}`,
    description: `ticket record for ${plate} (${state}) on ${city.shortName} open data.`,
    openGraph: {
      title: `${plate} (${state}) · ${city.shortName}`,
      description: `ticket record for ${plate} (${state}).`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogUrl],
    },
    robots: { index: false, follow: false },
  };
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export default async function LookupPage({ params }: PageProps) {
  const city = getCity(params.city);
  if (!city) notFound();

  const plate = normalizePlate(params.plate);
  const state = normalizeState(params.state);
  if (!isValidPlate(plate) || state.length !== 2) {
    return <InvalidState plate={params.plate} state={params.state} />;
  }

  if (!city.enabled) {
    return <ComingSoonState city={city} />;
  }

  let result: PlateLookupResult | null = null;
  let rank: RankInfo | null = null;
  let err: string | null = null;

  try {
    result = await city.lookup(plate, state);
    if (city.getRank) {
      rank = await city.getRank(result.totalViolations);
    }
  } catch (e) {
    if (e instanceof CityNotYetSupportedError) {
      return <ComingSoonState city={city} />;
    }
    if (e instanceof InvalidPlateError) {
      return <InvalidState plate={plate} state={state} />;
    }
    if (e instanceof UpstreamApiError) {
      err = `the city's data api is having a moment (status ${e.status}). try again in a minute.`;
    } else {
      err = "something went wrong fetching this plate.";
    }
  }

  if (err || !result) {
    return (
      <div className="container py-16 max-w-2xl">
        <h1 className="font-serif text-4xl font-black tracking-tight">we hit a wall.</h1>
        <p className="mt-3 text-muted-foreground italic">{err}</p>
        <Link href="/" className="mt-6 inline-block text-xs uppercase tracking-[0.18em] underline">
          ← back home
        </Link>
      </div>
    );
  }

  const siteUrl = getSiteUrl();
  const shareUrl = `${siteUrl}/lookup/${city.id}/${state}/${plate}`;
  const cityShort = city.shortName.toLowerCase();
  const finesStr = formatCurrency(result.totalFinesIssued, { compact: true });
  let shareText: string;
  if (result.totalViolations === 0) {
    shareText = `i have a clean driving record in ${cityShort}. boring.`;
  } else if (rank && rank.total > 0) {
    shareText = `i am the ${ordinalRank(rank.rank)} worst driver in ${cityShort} with ${finesStr} in fines.`;
  } else {
    shareText = `i have ${formatNumber(result.totalViolations)} tickets and ${finesStr} in fines in ${cityShort}.`;
  }

  const clean = result.totalViolations === 0;
  const rankPhrase =
    rank && rank.total > 0
      ? `the ${ordinalRank(rank.rank)} worst driver`
      : clean
        ? "a clean driver"
        : `a ticketed driver`;

  return (
    <div>
      {/* ─── DOSSIER HEADER ─── */}
      <section className="border-b border-foreground/15">
        <div className="container py-8 md:py-12">
          <div className="flex items-center gap-2 reveal reveal-1">
            <Link href="/" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
              ← back
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">case file</span>
          </div>

          <div className="mt-6 grid gap-8 md:grid-cols-12 md:gap-10">
            <div className="md:col-span-8 reveal reveal-2">
              <div className={cn("kicker", !clean && "kicker--accent")}>
                {clean ? "no record" : `${city.shortName} dept. of finance · public record`}
              </div>
              <h1 className="display mt-4 text-[clamp(2.5rem,7vw,6rem)]">
                plate <span className="italic">{plate}</span>
                <br />
                {clean ? (
                  <span>has a <span className="text-ok">clean record.</span></span>
                ) : (
                  <>
                    is <span className="text-accent">{rankPhrase}</span>
                    <br />in {cityShort}.
                  </>
                )}
              </h1>
              <p className="dek mt-5 max-w-xl">
                {clean ? (
                  <>no parking or camera violations recorded in the nyc open-data feed. boring.</>
                ) : (
                  <>
                    accrued {formatNumber(result.totalViolations)} violations totaling{" "}
                    <span className="not-italic text-foreground">{formatCurrency(result.totalFinesIssued)}</span> in fines{" "}
                    {result.firstViolationDate ? <>since {fmtDate(result.firstViolationDate)}</> : null}.
                  </>
                )}
              </p>

              {/* byline / metadata strip */}
              <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-t hairline pt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:grid-cols-4">
                <div>
                  <div className="opacity-60">plate</div>
                  <div className="text-foreground font-mono tracking-[0.1em] text-sm">{plate}</div>
                </div>
                <div>
                  <div className="opacity-60">state</div>
                  <div className="text-foreground text-sm">{state}</div>
                </div>
                <div>
                  <div className="opacity-60">first ticket</div>
                  <div className="text-foreground text-sm normal-case tracking-normal">{fmtDate(result.firstViolationDate)}</div>
                </div>
                <div>
                  <div className="opacity-60">last ticket</div>
                  <div className="text-foreground text-sm normal-case tracking-normal">{fmtDate(result.lastViolationDate)}</div>
                </div>
              </div>
            </div>

            <aside className="md:col-span-4 md:border-l md:hairline md:pl-10 flex flex-col items-start reveal reveal-3">
              <div className="rotate-[-1.5deg]">
                <PlateFrame plate={plate} state={state} className="text-4xl" />
              </div>
              <div className="mt-6 w-full">
                <ShareButton url={shareUrl} text={shareText} />
              </div>
              {result.cityPortalUrl ? (
                <a
                  href={result.cityPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                >
                  pay or contest at {city.shortName} portal →
                </a>
              ) : null}
            </aside>
          </div>
        </div>
      </section>

      {/* ─── HERO STAT BANNER (when not clean) ─── */}
      {!clean ? (
        <section className="border-b border-foreground/15 bg-foreground text-background">
          <div className="container py-10 md:py-12 reveal reveal-3">
            <div className="grid items-end gap-8 md:grid-cols-12">
              <div className="md:col-span-5">
                <div className="eyebrow text-background/60">total violations</div>
                <div className="stat-hero text-background">{formatNumber(result.totalViolations)}</div>
              </div>
              <div className="md:col-span-7 grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4 md:border-l md:border-background/15 md:pl-10">
                <StatBlock label="paid" value={formatNumber(result.totalPaid)} dark />
                <StatBlock label="unpaid" value={formatNumber(result.totalUnpaid)} dark accent={result.totalUnpaid > 0 ? "warn" : undefined} />
                <StatBlock label="dismissed" value={formatNumber(result.totalDismissed)} dark />
                <StatBlock
                  label="outstanding"
                  value={formatCurrency(result.totalFinesOutstanding, { compact: true })}
                  dark
                  accent={result.totalFinesOutstanding > 0 ? "warn" : undefined}
                />
              </div>
            </div>
            {rank && rank.total > 0 ? (
              <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-background/50">
                ranked <span className="text-background">#{formatNumber(rank.rank)}</span> of{" "}
                <span className="text-background">{formatNumber(rank.total)}</span> {cityShort} drivers indexed · lower rank = worse
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ─── DISCLAIMER ─── */}
      <section className="border-b border-foreground/15">
        <div className="container py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            this record describes the vehicle, not the current owner. plates change hands; the record does not.
          </p>
        </div>
      </section>

      {/* ─── EVIDENCE / VIOLATIONS ─── */}
      <section>
        <div className="container py-10 md:py-14">
          <div className="kicker">the evidence</div>
          <h2 className="display mt-3 text-[clamp(1.75rem,4vw,3rem)]">
            every ticket on file.
          </h2>
          <p className="dek mt-2">
            sortable by date, type, location, and status. source: nyc dof open parking & camera violations dataset.
          </p>
          <div className="mt-6">
            {result.violations.length === 0 ? (
              <div className="border-t-2 border-b border-foreground/85 py-16 text-center">
                <p className="font-serif text-3xl italic text-muted-foreground">no violations on file.</p>
                <p className="mt-2 text-sm text-muted-foreground">a boring, beautiful thing.</p>
              </div>
            ) : (
              <ViolationTable violations={result.violations} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatBlock({
  label,
  value,
  dark,
  accent,
}: {
  label: string;
  value: string;
  dark?: boolean;
  accent?: "warn" | "danger" | "ok";
}) {
  const accentCls =
    accent === "danger" ? "text-danger" :
    accent === "warn"   ? "text-accent" :
    accent === "ok"     ? "text-ok" :
                          dark ? "text-background" : "text-foreground";
  return (
    <div>
      <div className={cn("eyebrow", dark && "text-background/60")}>{label}</div>
      <div className={cn("font-serif text-3xl md:text-4xl font-bold tabular leading-none mt-2", accentCls)}>
        {value}
      </div>
    </div>
  );
}

function ComingSoonState({
  city,
}: {
  city: NonNullable<ReturnType<typeof getCity>>;
}) {
  return (
    <div className="container max-w-xl py-16">
      <div className="eyebrow">{city.shortName}</div>
      <h1 className="display mt-3 text-[clamp(2.5rem,7vw,5rem)]">coming soon.</h1>
      <p className="dek mt-4">
        nyc is live. {city.name} is next. drop your email and we'll let you know.
      </p>
      <div className="mt-6">
        <WaitlistForm city={city.id} />
      </div>
      <Link
        href="/lookup/nyc/NY/GBV6536"
        className="mt-8 inline-block text-[11px] uppercase tracking-[0.18em] underline"
      >
        try a live nyc plate →
      </Link>
    </div>
  );
}

function InvalidState({ plate, state }: { plate: string; state: string }) {
  return (
    <div className="container max-w-xl py-16">
      <h1 className="display text-[clamp(2.5rem,7vw,5rem)]">
        that doesn't look like a plate.
      </h1>
      <p className="dek mt-4">
        "{plate}" / "{state}" isn't valid. plates are 2–10 letters/numbers, state is two letters.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block text-[11px] uppercase tracking-[0.18em] underline"
      >
        ← back home
      </Link>
    </div>
  );
}
