# Ticket Leaderboard — Product Spec

Working title: **platerank** (rename freely). A public web app where anyone can look up a license plate and see a full violation history (paid + unpaid), total fines, and where that plate ranks against every other plate in the same city. Designed for content/virality with shareable rank cards.

---

## 1. Goal

Combine the two halves that already exist separately:

- **Plate lookup** (HowsMyDrivingNY shows raw counts, no context)
- **Worst-driver leaderboards** (Transportation Alternatives publishes top 10 once a year)

…into a single live, searchable, shareable product. Inspired by Spotify Wrapped's "you're in the top X%" mechanic.

**Primary virality loop:** user searches their own plate → sees percentile rank → downloads / tweets a share card → friend searches their plate to compare.

---

## 2. Scope

### MVP (ship this)
- NYC fully functional via NYC Open Data SODA API
- Plate + state search
- Paid / unpaid / total fines breakdown
- Violation list (type, date, location, fine, status)
- Live leaderboard (top 100 most-ticketed plates seen so far, refreshed daily)
- Percentile rank for any searched plate
- OG share card with rank, plate, totals
- Mobile-first responsive
- Methodology / disclaimer page

### Phase 2 (cities to add via adapter pattern)
- Washington DC (citation search by plate, scrapable)
- Philadelphia (PPA lookup)
- San Francisco (SFMTA citation search)
- Los Angeles
- Boston

Each city is one file implementing the `CityAdapter` interface. The MVP ships with NYC working and the other cities listed as "coming soon" with a waitlist email capture.

### Explicitly out of scope (don't build)
- Resolving plates to names (legal/privacy risk)
- Payment integration (link out to city portals)
- User accounts / auth
- Notifications / tracking
- Anything involving DMV records

---

## 3. Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Hosting:** Vercel
- **Cache:** Upstash Redis (free tier — for SODA API responses and rate limits)
- **Share cards:** `@vercel/og` for dynamic OG image generation
- **Analytics:** Vercel Analytics + Plausible (privacy-friendly)
- **Data fetching:** Server Components + Server Actions, no client-side SODA calls
- **Rate limiting:** Upstash Ratelimit (10 lookups / minute / IP)

No database needed for MVP. All data is fetched live from city APIs with Redis caching (24h TTL on lookups, 6h on leaderboard).

---

## 4. Architecture

### City Adapter Pattern

```ts
// lib/cities/types.ts
export interface Violation {
  id: string
  issueDate: string          // ISO
  violationType: string      // human-readable
  location?: string
  fineAmount: number         // dollars
  amountPaid: number
  amountDue: number
  status: 'paid' | 'unpaid' | 'in_dispute' | 'unknown'
  imageUrl?: string
}

export interface PlateLookupResult {
  city: string
  plate: string
  state: string
  totalViolations: number
  totalPaid: number
  totalUnpaid: number
  totalFinesIssued: number
  totalFinesPaid: number
  totalFinesOutstanding: number
  firstViolationDate?: string
  lastViolationDate?: string
  violations: Violation[]
  cityPortalUrl?: string     // link out to pay/contest
}

export interface CityAdapter {
  id: string                 // 'nyc', 'dc', etc.
  name: string               // 'New York City'
  shortName: string          // 'NYC'
  enabled: boolean
  supportedStates: string[]  // ['NY', 'NJ', 'CT', ...]
  lookup(plate: string, state: string): Promise<PlateLookupResult>
  getLeaderboard(limit: number): Promise<LeaderboardEntry[]>
  getPercentile(violationCount: number): Promise<number>
}
```

### File structure

```
app/
  page.tsx                              // hero + search + top of leaderboard
  lookup/[city]/[state]/[plate]/page.tsx // result page
  leaderboard/[city]/page.tsx           // full leaderboard
  methodology/page.tsx                   // data sources, caveats
  api/
    og/[city]/[state]/[plate]/route.tsx // OG share card
    lookup/route.ts                      // server endpoint
    waitlist/route.ts                    // email capture for non-NYC cities
lib/
  cities/
    index.ts                            // registry
    types.ts
    nyc.ts                              // SODA API adapter (fully built)
    dc.ts                               // stub
    philly.ts                           // stub
    sf.ts                               // stub
    la.ts                               // stub
    boston.ts                           // stub
  cache.ts                              // Upstash Redis wrapper
  ratelimit.ts                          // Upstash Ratelimit wrapper
  format.ts                             // currency, dates, plate normalization
components/
  PlateSearch.tsx                       // hero search input
  ResultCard.tsx                        // big number / percentile display
  ViolationTable.tsx                    // sortable list of violations
  RankBadge.tsx                         // "top 3% of NYC drivers"
  Leaderboard.tsx                       // ranked list
  ShareButton.tsx                       // twitter/copy link
  CityPicker.tsx                        // dropdown for city selection
```

---

## 5. Data Source: NYC (primary, fully build this)

**Dataset:** Open Parking and Camera Violations (`nc67-uf89`)
**Endpoint:** `https://data.cityofnewyork.us/resource/nc67-uf89.json`
**Auth:** None required for read. App token optional (recommend setting `NYC_OPEN_DATA_APP_TOKEN` env var to avoid throttling).

### Key fields
- `plate` — license plate string (uppercase, no spaces)
- `state` — two-letter state code
- `license_type` — PAS, COM, OMT (taxi), SRF (vanity), etc.
- `summons_number`
- `issue_date` — ISO date
- `violation` — human-readable description (e.g. "PHTO SCHOOL ZN SPEED VIOLATION")
- `fine_amount`, `penalty_amount`, `interest_amount`, `reduction_amount`, `payment_amount`, `amount_due`
- `precinct`, `county`, `issuing_agency`
- `judgment_entry_date`
- `summons_image` — JSON object with URL

### Example query (all violations for a plate)
```
GET https://data.cityofnewyork.us/resource/nc67-uf89.json?plate=ABC1234&state=NY&$limit=1000&$order=issue_date DESC
```

### Status derivation
- `amount_due === 0 AND payment_amount > 0` → `paid`
- `amount_due > 0` → `unpaid`
- Otherwise → `unknown`

### Leaderboard query
SODA doesn't natively support GROUP BY at scale across the full table, so we maintain our own leaderboard by:
1. Background cron (Vercel Cron, daily at 4am ET) that pulls aggregates via `$select=plate,state,count(*) as ct,sum(fine_amount) as fines&$group=plate,state&$order=ct DESC&$limit=500`
2. Cache the top 500 in Redis
3. Also compute percentile buckets (p50, p75, p90, p95, p99) and cache them
4. Live searches compare against these cached buckets for "you're in the top X%"

### Plate normalization
- Uppercase
- Strip spaces, dashes
- Reject empty / obviously bogus inputs (`< 2 chars` or `> 10 chars`)
- For temporary plates / "T" prefix variants, query both raw and normalized

---

## 6. Routes & Pages

### `/` — Home
- Hero with city picker + plate + state input
- Live "top 10 worst plates in NYC" feed below the search
- Three featured callouts: "Search a fleet" (TLC, NYPD, government), "View full leaderboard", "How this works"
- Mobile: search collapses to a single sticky input

### `/lookup/[city]/[state]/[plate]`
- Big hero number: total violations
- Stat row: paid count, unpaid count, total fines, outstanding
- RankBadge: "You're in the top 7% of NYC plates"
- Violation table (sortable, filter by paid/unpaid, paginated 25/page)
- Share button (twitter intent + copy link)
- "Pay or contest these at [official portal]" CTA linking to NYC DOF
- OG meta tags wired to `/api/og/[city]/[state]/[plate]`

### `/leaderboard/[city]`
- Top 100 most-ticketed plates
- Anonymized by default (`ABC****`) with a toggle to reveal (public data, plates are public)
- Columns: rank, plate, count, total fines, outstanding
- Filter by violation type (parking only, camera only, school zone, etc.)

### `/methodology`
- Where data comes from
- Update cadence
- Why some plates may be missing (ghost plates, defaced)
- Privacy: we don't collect plate searches, we don't link plates to people
- Legal: this is publicly-available open data published by the city; we link to official portals for any disputes
- ToS / DMCA / takedown contact

---

## 7. Share Card (OG image)

`@vercel/og` route at `/api/og/[city]/[state]/[plate]`. Generates a 1200x630 PNG with:

- Big plate number (the actual plate, styled like a NY plate)
- Total violation count (huge type)
- "Top X% of NYC plates" badge
- Paid / unpaid split
- Domain footer

Style: bold sans, high contrast, looks good in a tweet. Reference Spotify Wrapped's social cards.

Twitter share text template:
```
my nyc plate has [N] tickets and [$X] in fines.
top [X]% of the city's worst drivers.
look yours up → [url]
```

---

## 8. Caching & Rate Limits

- **Lookup cache:** Redis key `lookup:{city}:{state}:{plate}` → 24h TTL
- **Leaderboard cache:** Redis key `leaderboard:{city}` → 6h TTL, refreshed by daily cron
- **Percentile buckets:** Redis key `percentiles:{city}` → 24h TTL
- **Rate limit:** 10 lookups / minute / IP (Upstash Ratelimit fixed window)
- **Backend:** SODA API requests respect the documented update window (NYC pauses 1–2:30am and Sunday 5–10am)

---

## 9. Risks, Legal, Edge Cases

### Legal posture
- All data shown is publicly published by city governments and intended for public access.
- We do not link plates to names, addresses, or identities.
- We do not enable bulk download.
- We rate-limit to prevent abuse.
- ToS prohibits using the data for harassment, stalking, or commercial resale.
- DMCA / takedown email in footer; respond within 48h to credible removal requests for any plate that has been wrongly indexed.

### Privacy
- No user accounts.
- No persistent storage of plate searches (search logs purged after 7 days).
- No third-party analytics that fingerprint users (Plausible only).
- HTTPS only.

### Data caveats (document on /methodology)
- Ghost plates / defaced plates underreport. NYC speed cameras failed to ticket ~22% of offending vehicles in early 2023 due to obscured plates.
- Dismissed / overturned violations may still appear in the dataset.
- Out-of-state plates are tracked but their rankings may be incomplete.
- Plate changes (sold cars, new owners) are not linked — the leaderboard ranks plates, not drivers.

### Anti-harassment
- Disclaimer on every result page: "This data reflects the vehicle, not the current owner."
- No reverse lookup by name.
- Disable scraping (Cloudflare / Vercel firewall rules).

---

## 10. Visual & Brand Direction

- **Aesthetic:** clean, slightly editorial, news-product energy (think Streetsblog meets Stripe's marketing site)
- **Color:** monochrome base with a single accent (suggest: orange `#FF6B35` for fines, green for paid, red for outstanding)
- **Type:** Inter or Geist for UI, a serif (Tiempos, IBM Plex Serif) for big numbers / headlines
- **Plate visual:** render plates in a styled "license plate" frame on result cards (varies subtly by state)
- **Mobile-first**, but desktop should feel premium for the press-coverage shot

---

## 11. Launch Checklist

- [ ] NYC adapter working end-to-end
- [ ] OG share cards rendering correctly on Twitter / iMessage / Slack
- [ ] Leaderboard cron running daily
- [ ] Rate limiting enforced
- [ ] Methodology + ToS pages live
- [ ] Mobile QA on iOS Safari + Android Chrome
- [ ] One celebrity / fleet plate to seed the launch tweet (e.g. an NYPD plate, a known super-speeder from the TA list)
- [ ] Plausible analytics installed
- [ ] DMCA email set up
- [ ] Lighthouse score > 90 on home + lookup
- [ ] Vercel firewall rules: rate limit, block scrapers
- [ ] robots.txt: allow indexing of `/`, `/leaderboard/*`, `/methodology`; disallow `/lookup/*` (to avoid SEO-indexing every plate)

---

## 12. Future Ideas (post-launch)

- City expansion via adapters (DC, Philly, SF, LA, Boston, Seattle)
- "Fleet" pages: precomputed leaderboards for NYPD, FDNY, congressional plates, TLC medallions
- "Worst block" geographic leaderboard
- Annual "wrapped" recap for any plate
- Embed widget: news outlets paste an iframe to display a plate's record inline
- Twitter bot that auto-posts rank cards when tagged with a plate

---

## 13. Environment Variables

```
NYC_OPEN_DATA_APP_TOKEN=         # optional but recommended
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
WAITLIST_EMAIL_DESTINATION=      # for non-NYC city waitlist signups
DMCA_CONTACT_EMAIL=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=
```
