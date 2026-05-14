import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { getSiteUrl } from "@/lib/utils";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "platerank — look up any nyc plate's ticket record",
    template: "%s · platerank",
  },
  description:
    "see any nyc plate's full violation history, total fines, and percentile rank against the worst drivers in the city.",
  openGraph: {
    title: "platerank",
    description: "look up any nyc plate's ticket record.",
    url: siteUrl,
    siteName: "platerank",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "platerank",
    description: "look up any nyc plate's ticket record.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  return (
    <html lang="en">
      <head>
        {plausibleDomain ? (
          <script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
          />
        ) : null}
      </head>
      <body className="min-h-screen flex flex-col font-sans">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-3 w-3 rounded-sm bg-accent" aria-hidden />
          platerank
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/leaderboard/nyc" className="hover:text-foreground">
            leaderboard
          </Link>
          <Link
            href="/methodology"
            aria-label="methodology"
            title="methodology"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
          >
            ?
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  const dmca = process.env.DMCA_CONTACT_EMAIL || "takedowns@platerank.com";
  return (
    <footer className="mt-16 border-t border-border">
      <div className="container py-8 text-xs text-muted-foreground flex flex-col gap-2 md:flex-row md:justify-between">
        <p>
          public data from city open-data portals. not affiliated with any city agency.
        </p>
        <p>
          dmca/takedown:{" "}
          <a href={`mailto:${dmca}`} className="underline hover:text-foreground">
            {dmca}
          </a>
        </p>
      </div>
    </footer>
  );
}
