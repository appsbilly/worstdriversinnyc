import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "methodology",
  description: "where the data comes from, how the ranking is calculated, and what's missing.",
};

export default function MethodologyPage() {
  return (
    <article>
      <section className="border-b border-foreground/15">
        <div className="container py-10 md:py-14 max-w-3xl">
          <div className="kicker reveal reveal-1">how this works</div>
          <h1 className="display mt-4 text-[clamp(2.5rem,7vw,6rem)] reveal reveal-2">
            methodology.
          </h1>
          <p className="dek mt-5 reveal reveal-2">
            what we use, what we don't, and the caveats that matter for reading this data honestly.
          </p>
        </div>
      </section>

      <div className="container max-w-3xl py-10 md:py-14">
        <Section kicker="source" title="where the data comes from">
          <p>
            for new york city we query the{" "}
            <a
              className="underline decoration-foreground/30 underline-offset-4 hover:text-accent hover:decoration-accent"
              href="https://data.cityofnewyork.us/City-Government/Open-Parking-and-Camera-Violations/nc67-uf89"
              target="_blank"
              rel="noopener noreferrer"
            >
              open parking and camera violations dataset
            </a>{" "}
            published by the nyc department of finance through the city's open-data portal. this is the same public record the city itself publishes for transparency.
          </p>
        </Section>

        <Section kicker="cadence" title="how often it refreshes">
          <p>
            individual plate lookups query the dataset on demand and cache results for 24 hours. the leaderboard rebuilds once per day via a scheduled job that scans the most recent slice of the open-data feed.
          </p>
        </Section>

        <Section kicker="ranking" title="how the rank is computed">
          <p>
            we count violations per plate across the data window, then assign{" "}
            <span className="italic">standard competition ranking</span>:
            plates tied at the same violation count share a rank, and the next distinct count skips by the size of the tie group (so if 100 plates tie at the top, all are #1 and the next plate is #101). rank #1 is the most-ticketed plate.
          </p>
        </Section>

        <Section kicker="caveats" title="what's missing">
          <ul className="list-disc pl-5 space-y-2 marker:text-muted-foreground">
            <li>
              ghost plates and defaced plates underreport. nyc speed cameras failed to ticket roughly 22% of offending vehicles in early 2023 due to obscured plates.
            </li>
            <li>dismissed or successfully disputed violations are labeled accordingly but still appear in the historical record.</li>
            <li>out-of-state plates are tracked but their rankings may be incomplete because we only see their nyc activity.</li>
            <li>plates change hands. this record is about the plate, not the current owner.</li>
          </ul>
        </Section>

        <Section kicker="privacy" title="what we don't do">
          <ul className="list-disc pl-5 space-y-2 marker:text-muted-foreground">
            <li>no user accounts. nothing to log in to.</li>
            <li>we don't store plate searches.</li>
            <li>we don't link plates to names, addresses, or identities.</li>
            <li>rate-limited at 10 lookups per minute per ip to prevent bulk scraping.</li>
          </ul>
        </Section>

        <Section kicker="legal" title="legal posture">
          <p>
            this is publicly-available open data published by city governments. we link to the official portals for any disputes or payment. using this data for harassment, stalking, or commercial resale violates our terms.
          </p>
          <p className="mt-3">
            if you believe a record should be removed, file a takedown request through the underlying open-data portal — that is the system of record, and any correction propagates here on the next refresh.
          </p>
        </Section>
      </div>
    </article>
  );
}

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t-2 border-foreground/85 py-8 first:border-t-0 first:pt-0">
      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <div className="eyebrow">{kicker}</div>
          <h2 className="font-serif text-xl md:text-2xl font-black tracking-tight mt-2">{title}</h2>
        </div>
        <div className="md:col-span-9 text-base leading-relaxed text-foreground/85">
          {children}
        </div>
      </div>
    </section>
  );
}
