import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/leaderboard/", "/methodology"],
        disallow: ["/lookup/", "/api/", "/?b=", "/*?b="],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
