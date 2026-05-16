"use client";

import { cn } from "@/lib/utils";

interface ShareButtonProps {
  /** Bare site URL (no trailing slash assumed). */
  tweetSiteUrl: string;
  plate: string;
  state: string;
  tweetText: string;
  className?: string;
}

/**
 * The "tweet this" button. Builds a Twitter Intent URL pointing at the bare
 * site domain with an opaque `?b=<token>` so the tweet preview shows the
 * personal badge image without exposing the plate-specific lookup URL.
 */
export function ShareButton({
  tweetSiteUrl,
  plate,
  state,
  tweetText,
  className,
}: ShareButtonProps) {
  const token = encodeBadgeToken(plate, state);
  const tweetUrl = `${tweetSiteUrl.replace(/\/+$/, "")}/?b=${token}`;
  const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}&url=${encodeURIComponent(tweetUrl)}`;

  return (
    <a
      href={tweetIntent}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-10 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-accent transition-colors",
        className,
      )}
    >
      tweet this
    </a>
  );
}

function encodeBadgeToken(plate: string, state: string): string {
  // base64url("STATE|PLATE") — not a security boundary, just casual obfuscation
  // so the plate isn't immediately visible in the URL preview.
  const raw = `${state}|${plate}`;
  const b64 = typeof btoa === "function" ? btoa(raw) : Buffer.from(raw).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
