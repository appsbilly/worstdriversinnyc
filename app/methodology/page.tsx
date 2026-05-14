import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "methodology",
  description: "where the data comes from, how percentiles are calculated, and what's missing.",
};

export default function MethodologyPage() {
  return (
    <article className="container max-w-2xl py-12 prose-neutral">
      <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">methodology</h1>
      <p className="mt-2 text-muted-foreground">
        what we use, what we don't, and the caveats that matter.
      </p>

      <Section title="where the data comes from">
        <p>
          for new york city we query the{" "}
          <a
            className="underline"
            href="https://data.cityofnewyork.us/City-Government/Open-Parking-and-Camera-Violations/nc67-uf89"
            target="_blank"
            rel="noopener noreferrer"
          >
            open parking and camera violations dataset
          </a>{" "}
          published by the nyc department of finance through the city's open-data portal.
          this is the same public record the city itself publishes for transparency.
        </p>
      </Section>

      <Section title="update cadence">
        <p>
          live plate lookups query the dataset on demand and cache results for 24 hours.
          the leaderboard refreshes once per day via a scheduled job.
        </p>
      </Section>

      <Section title="percentile rank">
        <p>
          we compute violation-count cutoffs (p50, p75, p90, p95, p99) from the top of
          the distribution and place each looked-up plate into a bucket. it's a
          rough-but-honest rank, not a precise statistical position. a plate in "top 5%"
          has more violations than at least 95% of plates we've observed.
        </p>
      </Section>

      <Section title="what's missing">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            ghost plates and defaced plates underreport. nyc speed cameras failed to
            ticket roughly 22% of offending vehicles in early 2023 due to obscured
            plates.
          </li>
          <li>
            dismissed or overturned violations may still appear in the dataset.
          </li>
          <li>
            out-of-state plates are tracked but their rankings may be incomplete because
            we only see their nyc activity.
          </li>
          <li>
            plates change hands. this record is about the plate, not the current owner.
          </li>
        </ul>
      </Section>

      <Section title="privacy">
        <ul className="list-disc pl-5 space-y-1">
          <li>no user accounts. nothing to log in to.</li>
          <li>we don't store plate searches.</li>
          <li>we don't link plates to names, addresses, or identities.</li>
          <li>rate-limited at 10 lookups per minute per ip to prevent bulk scraping.</li>
        </ul>
      </Section>

      <Section title="legal">
        <p>
          this is publicly-available open data published by city governments. we link to
          the official portals for any disputes or payment. using this data for
          harassment, stalking, or commercial resale violates our terms.
        </p>
        <p className="mt-3">
          if you believe a record should be removed, file a takedown request through
          the underlying open-data portal — that is the system of record, and any
          correction propagates here on the next refresh.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
