# platerank

look up any nyc license plate, see its full ticket record, total fines, and where it ranks against every other plate in the city.

public data, finally readable. inspired by the spotify wrapped "top X%" mechanic.

## what this is

- **plate lookup** against the nyc open data soda api (`nc67-uf89` — open parking and camera violations).
- **percentile rank** against a daily-refreshed leaderboard of the top 500 most-ticketed plates.
- **shareable og card** rendered at `/api/og/[city]/[state]/[plate]` for tweet/imessage previews.
- **city adapter pattern** so dc, philly, sf, la, boston can be added one file at a time. those cities currently render a "coming soon" state with email capture.

no accounts, no payments, no dmv lookups, no plate-to-name resolution.

## stack

- next.js 14 (app router) + typescript (strict)
- tailwind + a small set of shadcn-style components
- upstash redis for the lookup cache, leaderboard cache, and rate limit
- `@vercel/og` for the share card
- deployed to vercel; daily cron via `vercel.json`

## run it locally

```bash
cp .env.example .env.local
# fill in UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN at minimum
# NYC_OPEN_DATA_APP_TOKEN is optional but recommended
npm install
npm run dev
```

then open http://localhost:3000 and search a plate. for a known public example, try `GBV6536 / NY`.

## env vars

| name | required | what it does |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | yes | upstash rest url (used by cache + ratelimit) |
| `UPSTASH_REDIS_REST_TOKEN` | yes | upstash rest token |
| `NYC_OPEN_DATA_APP_TOKEN` | recommended | raises soda api throttling thresholds |
| `CRON_SECRET` | yes (prod) | bearer token the leaderboard cron must present |
| `NEXT_PUBLIC_SITE_URL` | yes | absolute origin for og image urls + sitemap |
| `DMCA_CONTACT_EMAIL` | yes | shown in footer + methodology page |
| `WAITLIST_EMAIL_DESTINATION` | optional | destination for non-nyc waitlist signups |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | optional | enables plausible analytics |

without upstash configured the app degrades gracefully: lookups still work (just uncached), rate-limit is bypassed, the leaderboard returns empty until next cron run.

## deploying to vercel

```bash
npm install -g vercel
vercel link
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add NYC_OPEN_DATA_APP_TOKEN production
vercel env add CRON_SECRET production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel env add DMCA_CONTACT_EMAIL production
vercel deploy --prod
```

after the first deploy:

1. trigger `/api/cron/leaderboard?secret=<CRON_SECRET>` once to seed redis.
2. confirm `/leaderboard/nyc` renders rows.
3. confirm the og card at `/api/og/nyc/NY/GBV6536` returns a 1200×630 png.

the daily cron is defined in [`vercel.json`](./vercel.json) and runs at 08:00 utc (≈ 4am et) against `/api/cron/leaderboard`.

## adding a new city

1. duplicate `lib/cities/dc.ts` → `lib/cities/<id>.ts`.
2. set `enabled: true` and implement `lookup`, `getLeaderboard`, `getPercentile` against that city's open-data endpoint. follow the patterns in [`lib/cities/nyc.ts`](./lib/cities/nyc.ts):
   - normalize plate input,
   - cache lookups in redis with `TTL.LOOKUP`,
   - retry upstream 429s with exponential backoff,
   - throw `UpstreamApiError` / `InvalidPlateError` / `CityNotYetSupportedError` as appropriate.
3. register the adapter in [`lib/cities/index.ts`](./lib/cities/index.ts).
4. add a daily cron entry in `vercel.json` if the city needs its own leaderboard refresh.

the registry is the only place anywhere in the codebase that knows about specific cities — pages, api routes, og card, share button, and rate limiter all work off the `CityAdapter` interface.

## architecture notes

- `app/lookup/[city]/[state]/[plate]/page.tsx` is the result page. it is `dynamic = "force-dynamic"` so each lookup hits the cache or upstream; the redis ttl is what actually controls cost.
- `app/api/lookup/route.ts` is a json endpoint that wraps the same adapter call with rate limiting. useful for embeds and future a/b testing.
- `app/api/cron/leaderboard/route.ts` is the daily aggregator. it must be hit with a `Bearer <CRON_SECRET>` header (vercel cron does this automatically when `CRON_SECRET` is set on the project).
- `app/api/og/[city]/[state]/[plate]/route.tsx` uses the edge runtime (`@vercel/og` requirement) and reads the same adapter, so the share card always reflects the latest cached lookup.
- `robots.ts` disallows `/lookup/*` to keep individual plate pages out of search indexes.

## legal posture

every byte of data shown is published by city governments through their open-data portals and intended for public access. we do not link plates to names. we rate-limit to deter bulk scraping. takedown requests go to the email in the footer and we respond within 48h.

see [/methodology](https://platerank.com/methodology) for the long version.
