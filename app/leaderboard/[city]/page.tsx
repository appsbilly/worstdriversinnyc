import { Leaderboard } from "@/components/Leaderboard";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getCity } from "@/lib/cities";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 3600;

interface PageProps {
  params: { city: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const city = getCity(params.city);
  if (!city) return { title: "leaderboard" };
  return {
    title: `${city.shortName} leaderboard`,
    description: `the most-ticketed plates in ${city.name}, refreshed daily.`,
  };
}

export default async function LeaderboardPage({ params }: PageProps) {
  const city = getCity(params.city);
  if (!city) notFound();

  if (!city.enabled) {
    return (
      <div className="container max-w-xl py-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {city.shortName}
        </p>
        <h1 className="mt-2 font-serif text-4xl font-bold">leaderboard coming soon.</h1>
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

  let entries: Awaited<ReturnType<typeof city.getLeaderboard>> = [];
  try {
    entries = await city.getLeaderboard(100);
  } catch {
    entries = [];
  }

  return (
    <div className="container py-10 max-w-5xl">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {city.shortName} · leaderboard
      </p>
      <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight md:text-5xl">
        the worst plates in {city.shortName.toLowerCase()}.
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        ranked by total parking + camera violations in the city's open-data dataset.
        plates are anonymized by default. tap reveal to view, or look up a specific one.
      </p>
      <div className="mt-8">
        <Leaderboard entries={entries} city={city.id} />
      </div>
    </div>
  );
}
