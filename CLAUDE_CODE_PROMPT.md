# Claude Code One-Shot Prompt

Copy everything below the line and paste into a fresh Claude Code session inside an empty directory.

---

You are building a public web app called **platerank** that lets anyone look up a license plate and see its full violation history (paid + unpaid), total fines, and percentile rank against every other plate in the same city. The full product spec is in `PRD.md` in this directory — read it first, then build.

**Hard requirements:**

1. **Read `PRD.md` completely before writing any code.** It defines architecture, data sources, routes, and the `CityAdapter` interface. Do not deviate.
2. **Stack:** Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, deployed to Vercel. Upstash Redis for caching and rate limits. `@vercel/og` for share cards.
3. **NYC must work end-to-end.** Real plate lookups against the SODA API at `https://data.cityofnewyork.us/resource/nc67-uf89.json`, real data displayed, real percentile rank against cached leaderboard buckets.
4. **Other cities (DC, Philly, SF, LA, Boston) are stubs** that implement the `CityAdapter` interface but return a "coming soon — join waitlist" response. Build the registry so adding a real adapter later is one file.
5. **Build the share card** at `/api/og/[city]/[state]/[plate]` using `@vercel/og`. Test it renders a 1200×630 PNG with plate, total tickets, total fines, and percentile badge.
6. **Build the daily leaderboard cron** as a Vercel Cron job that pulls the top 500 plates from NYC's SODA API, stores them in Redis, and computes percentile buckets (p50, p75, p90, p95, p99).
7. **No user accounts, no payments, no DMV lookups, no plate-to-name resolution.** This is publicly-available open data with privacy guardrails.

**Build order:**

1. Scaffold Next.js with TypeScript + Tailwind. Initialize shadcn/ui.
2. Set up `lib/cities/types.ts` with the interfaces from PRD section 4.
3. Build `lib/cities/nyc.ts` — the full SODA API adapter. Include plate normalization, status derivation, error handling, retries on 429.
4. Stub `lib/cities/{dc,philly,sf,la,boston}.ts` — each exports an adapter where `enabled: false` and `lookup()` throws a `CityNotYetSupportedError`.
5. Build `lib/cache.ts` (Upstash Redis wrapper) and `lib/ratelimit.ts` (10/min/IP).
6. Build the cron at `app/api/cron/leaderboard/route.ts`. Secure it with a `CRON_SECRET` header check. Configure `vercel.json` to run daily at 4am ET.
7. Build pages in this order: `/`, `/lookup/[city]/[state]/[plate]`, `/leaderboard/[city]`, `/methodology`.
8. Build components: `PlateSearch`, `ResultCard`, `ViolationTable`, `RankBadge`, `Leaderboard`, `ShareButton`, `CityPicker`.
9. Build `/api/og/[city]/[state]/[plate]/route.tsx` with `@vercel/og`. Plate rendered to look like a state plate. Bold typography.
10. Wire up OG meta tags on lookup pages so Twitter/iMessage previews work.
11. Add `robots.txt` (allow `/`, `/leaderboard/*`, `/methodology`; disallow `/lookup/*`).
12. Add a `.env.example` listing every env var from PRD section 13.
13. Write a `README.md` with: what this is, how to run it locally, how to deploy, how to add a new city adapter.

**Style requirements:**

- Mobile-first responsive design.
- Aesthetic: clean editorial, news-product feel. Monochrome base + one accent color. Big serif numbers for hero stats. Sans for UI.
- Render plates inside a styled license-plate frame on the result page.
- The share card needs to look great in a tweet — bold, high contrast, the percentile rank is the hero.
- Don't use emoji in UI copy unless functional. Don't use em dashes in copy.
- Default copy voice: lowercase, direct, slightly cheeky. Example: "your plate has 47 tickets. top 4% of nyc."

**Quality bar:**

- TypeScript strict mode, no `any`.
- All server fetches have try/catch with user-facing error states.
- Loading states on all data fetches.
- Empty state when a plate has zero violations: "clean record. boring."
- Lighthouse score target: 90+ on home and lookup pages.
- Handle these edge cases: plate not found, SODA API down, rate limit hit, invalid plate format, plate with 1000+ violations (paginate).

**Things to verify before declaring done:**

- [ ] `npm run dev` boots cleanly with no warnings
- [ ] Search "GBV6536 / NY" (a public example from press coverage) and see real results
- [ ] OG image renders at `/api/og/nyc/NY/GBV6536` and looks good
- [ ] Visiting `/lookup/nyc/NY/GBV6536` shows the full result page
- [ ] Twitter share button generates a working tweet intent URL
- [ ] Hitting the lookup endpoint 11 times in a minute returns a 429 on the 11th
- [ ] Visiting `/lookup/dc/DC/AB1234` shows a "coming soon" state with waitlist email capture
- [ ] `/methodology` and `/leaderboard/nyc` render

**Out of scope — do NOT build:**

- User auth, payments, or anything that creates a logged-in experience
- A database (Postgres / Supabase). Cache is Redis only.
- Any feature that resolves a plate to a person's name, address, or identity
- Scrapers for non-NYC cities (those are Phase 2 and need separate review)

When you're done, output:
1. A summary of what's built
2. The exact env vars I need to set on Vercel
3. The command sequence to deploy (`vercel deploy --prod`)
4. The first three things to test after deploy
