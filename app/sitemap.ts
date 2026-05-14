import type { MetadataRoute } from "next";
import { listCities } from "@/lib/cities";
import { getSiteUrl } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const cities = listCities();
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/methodology`, changeFrequency: "monthly", priority: 0.5 },
    ...cities.map((c) => ({
      url: `${siteUrl}/leaderboard/${c.id}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
