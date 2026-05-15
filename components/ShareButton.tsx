"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  /** URL the "copy link" action puts on the clipboard. Typically the specific lookup URL. */
  copyUrl: string;
  /** Bare site URL (e.g. https://www.worstdriversinnyc.com) that the tweet links to. */
  tweetSiteUrl: string;
  /** Plate + state used to build a query string so the home page's OG image renders the personal badge. */
  plate: string;
  state: string;
  /** Pre-composed tweet text. */
  tweetText: string;
  className?: string;
}

export function ShareButton({
  copyUrl,
  tweetSiteUrl,
  plate,
  state,
  tweetText,
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  // Tweet URL is the home page with the plate encoded as a query param. The home
  // page's `generateMetadata` reads `b` and points og:image at the personal badge,
  // so Twitter shows the badge in the preview — but the link itself just goes to
  // the home page when a human clicks it (not the doxxy lookup URL).
  const token = encodeBadgeToken(plate, state);
  const tweetUrl = `${tweetSiteUrl.replace(/\/+$/, "")}/?b=${token}`;

  const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}&url=${encodeURIComponent(tweetUrl)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <a
        href={tweetIntent}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-accent transition-colors"
      >
        tweet this
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
      >
        {copied ? "copied" : "copy link"}
      </button>
    </div>
  );
}

function encodeBadgeToken(plate: string, state: string): string {
  // base64url("STATE|PLATE") — not a security boundary, just casual obfuscation
  // so the plate isn't immediately visible in the URL preview.
  const raw = `${state}|${plate}`;
  const b64 = typeof btoa === "function" ? btoa(raw) : Buffer.from(raw).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
