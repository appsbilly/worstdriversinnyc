import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { getSiteUrl } from "@/lib/utils";
import { Inter, Source_Serif_4 } from "next/font/google";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-serif",
  display: "swap",
});

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
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
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
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
    .format(new Date())
    .toLowerCase();
  return (
    <header className="border-b border-foreground/15">
      <div className="container">
        <div className="flex items-end justify-between pt-6 pb-3">
          <div className="hidden md:block text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            vol. i · {today}
          </div>
          <Link
            href="/"
            className="font-serif text-3xl font-black tracking-tight leading-none md:absolute md:left-1/2 md:-translate-x-1/2"
          >
            worstdriversinnyc
          </Link>
          <nav className="flex items-center gap-5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/leaderboard/nyc" className="hover:text-foreground">
              leaderboard
            </Link>
            <Link
              href="/methodology"
              aria-label="methodology"
              title="methodology"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-foreground/25 text-xs font-semibold text-muted-foreground transition hover:border-foreground hover:text-foreground"
            >
              ?
            </Link>
          </nav>
        </div>
        <div className="hidden md:flex items-center justify-between border-t border-foreground/15 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>a public records leaderboard · new york</span>
          <span>data: nyc dept. of finance · refreshed daily</span>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-foreground/15">
      <div className="container py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <p className="font-serif text-2xl font-black tracking-tight">worstdriversinnyc</p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              a public-records leaderboard built on the nyc department of finance's open parking and camera violations dataset. not affiliated with any city agency. data reflects the vehicle, not the current owner.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">home</Link>
            <Link href="/leaderboard/nyc" className="hover:text-foreground">leaderboard</Link>
            <Link href="/methodology" className="hover:text-foreground">methodology</Link>
            <a
              href="https://data.cityofnewyork.us/City-Government/Open-Parking-and-Camera-Violations/nc67-uf89"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              source dataset
            </a>
          </div>
        </div>
        <p className="mt-8 border-t border-foreground/10 pt-4 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          built for journalism &amp; public accountability
        </p>
      </div>
    </footer>
  );
}
