/**
 * Fetch font files for use inside an `@vercel/og` `ImageResponse`.
 * Edge runtime can't access local files, so we pull straight from a CDN.
 * Results are cached per process (in-memory) so a hot edge container only
 * pays the network cost once.
 */
const cache = new Map<string, ArrayBuffer>();

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const cached = cache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch font ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  cache.set(url, buf);
  return buf;
}

/**
 * Load the editorial type pair used in OG cards.
 *
 * - Inter for big numbers and tight UI text (high legibility at thumbnail size)
 * - Source Serif Pro for italic deks / accents (the editorial flourish)
 */
export async function loadOgFonts() {
  const [interBold, interBlack, serifItalic] = await Promise.all([
    fetchFont(
      "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.otf",
    ),
    fetchFont(
      "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Black.otf",
    ),
    fetchFont(
      "https://github.com/adobe-fonts/source-serif/raw/release/OTF/SourceSerif4-BlackIt.otf",
    ),
  ]);
  return [
    { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
    { name: "Inter", data: interBlack, weight: 900 as const, style: "normal" as const },
    { name: "Serif", data: serifItalic, weight: 900 as const, style: "italic" as const },
  ];
}
