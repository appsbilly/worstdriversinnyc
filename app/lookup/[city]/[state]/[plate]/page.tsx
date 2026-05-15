import { LookupResultView } from "@/components/LookupResultView";
import { WaitlistForm } from "@/components/WaitlistForm";
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
  formatDate,
  formatNumber,
  isValidPlate,
  normalizePlate,
  normalizeState,
  ordinalRank,
} from "@/lib/format";
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
  let histogram: Record<string, number> | null = null;
  let err: string | null = null;

  try {
    result = await city.lookup(plate, state);
    if (city.getRank) {
      rank = await city.getRank(result.totalViolations, result.totalFinesIssued);
    }
    if (city.getRankHistogram) {
      histogram = await city.getRankHistogram();
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
        <h1 className="font-serif text-3xl font-black tracking-tight">we hit a wall</h1>
        <p className="mt-3 text-muted-foreground">{err}</p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          ← back home
        </Link>
      </div>
    );
  }

  const siteUrl = getSiteUrl();
  // copy link is the specific lookup (deliberate user share).
  // tweet links to the home page; ShareButton appends a `?b=<token>` so the
  // home page's og:image renders the personal badge in the tweet preview
  // — without the clickable URL leaking the plate.
  const shareUrl = `${siteUrl}/lookup/${city.id}/${state}/${plate}`;
  const cityShort = city.shortName.toLowerCase();
  const finesStr = formatCurrency(result.totalFinesIssued, { compact: true });
  let tweetText: string;
  if (result.totalViolations === 0) {
    tweetText = `i have a clean driving record in ${cityShort}. boring.`;
  } else if (rank && rank.total > 0) {
    tweetText = `i am the ${ordinalRank(rank.rank)} worst driver in ${cityShort} with ${finesStr} in fines.`;
  } else {
    tweetText = `i have ${formatNumber(result.totalViolations)} tickets and ${finesStr} in fines in ${cityShort}.`;
  }

  return (
    <div className="container py-6 md:py-12 max-w-5xl">
      <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← back
      </Link>

      <div className="mt-4">
        <LookupResultView
          result={result}
          rank={rank}
          histogram={histogram}
          cityShortName={cityShort}
          cityPortalUrl={result.cityPortalUrl}
          shareUrl={shareUrl}
          tweetSiteUrl={siteUrl}
          plate={plate}
          state={state}
          tweetText={tweetText}
        />
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
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {city.shortName}
      </p>
      <h1 className="mt-2 font-serif text-4xl font-black tracking-tight">coming soon.</h1>
      <p className="mt-3 text-muted-foreground">
        nyc is live. {city.name} is next. drop your email and we'll let you know the moment lookups go live.
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
      <h1 className="font-serif text-3xl font-black tracking-tight">that doesn't look like a plate.</h1>
      <p className="mt-3 text-muted-foreground">
        "{plate}" / "{state}" isn't valid. plates are 2–10 letters/numbers, state is two letters.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        ← back home
      </Link>
    </div>
  );
}
