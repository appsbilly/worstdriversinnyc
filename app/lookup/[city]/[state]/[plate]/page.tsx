import { ResultCard } from "@/components/ResultCard";
import { ShareButton } from "@/components/ShareButton";
import { ViolationTable } from "@/components/ViolationTable";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getCity } from "@/lib/cities";
import {
  CityNotYetSupportedError,
  InvalidPlateError,
  PlateLookupResult,
  RankInfo,
  UpstreamApiError,
} from "@/lib/cities/types";
import { formatCurrency, formatNumber, isValidPlate, normalizePlate, normalizeState } from "@/lib/format";
import { getSiteUrl } from "@/lib/utils";
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
        <h1 className="font-serif text-3xl font-bold">we hit a wall</h1>
        <p className="mt-3 text-muted-foreground">{err}</p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          ← back home
        </Link>
      </div>
    );
  }

  const siteUrl = getSiteUrl();
  const shareUrl = `${siteUrl}/lookup/${city.id}/${state}/${plate}`;
  const rankPhrase =
    rank && rank.total > 0
      ? `ranked #${formatNumber(rank.rank)} of ${formatNumber(rank.total)} worst ${city.shortName.toLowerCase()} drivers.`
      : "";
  const shareText =
    result.totalViolations === 0
      ? `my ${city.shortName.toLowerCase()} plate has zero tickets. boring. look yours up →`
      : `my ${city.shortName.toLowerCase()} plate has ${formatNumber(
          result.totalViolations,
        )} tickets and ${formatCurrency(result.totalFinesIssued, {
          compact: true,
        })} in fines.${rankPhrase ? ` ${rankPhrase}` : ""} look yours up →`;

  return (
    <div className="container py-10 md:py-12 max-w-5xl">
      <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← back
      </Link>

      <div className="mt-4">
        <ResultCard result={result} rank={rank} cityShortName={city.shortName.toLowerCase()} />
      </div>

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <ShareButton url={shareUrl} text={shareText} />
        {result.cityPortalUrl ? (
          <a
            href={result.cityPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline decoration-muted-foreground underline-offset-4 hover:text-foreground"
          >
            pay or contest at the official {city.shortName} portal →
          </a>
        ) : null}
      </div>

      <p className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        this data reflects the vehicle, not the current owner. plates change hands; this
        record does not follow people.
      </p>

      <section className="mt-10">
        <h2 className="mb-3 font-serif text-2xl font-bold">violations</h2>
        {result.violations.length === 0 ? (
          <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
            clean record. boring.
          </div>
        ) : (
          <ViolationTable violations={result.violations} />
        )}
      </section>
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
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {city.shortName}
      </p>
      <h1 className="mt-2 font-serif text-4xl font-bold">coming soon.</h1>
      <p className="mt-3 text-muted-foreground">
        nyc is live. {city.name} is next. drop your email and we'll let you know the
        moment lookups go live.
      </p>
      <div className="mt-6">
        <WaitlistForm city={city.id} />
      </div>
      <Link
        href="/lookup/nyc/NY/GBV6536"
        className="mt-8 inline-block text-sm underline"
      >
        try a live nyc plate instead →
      </Link>
    </div>
  );
}

function InvalidState({ plate, state }: { plate: string; state: string }) {
  return (
    <div className="container max-w-xl py-16">
      <h1 className="font-serif text-3xl font-bold">that doesn't look like a plate.</h1>
      <p className="mt-3 text-muted-foreground">
        "{plate}" / "{state}" isn't valid. plates are 2–10 letters/numbers, state is two
        letters.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        ← back home
      </Link>
    </div>
  );
}
