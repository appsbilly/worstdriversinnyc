"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  /** Specific URL used by both buttons. Tweet uses it so the OG card surfaces. */
  copyUrl: string;
  /** Pre-composed tweet text. Twitter appends the URL automatically. */
  tweetText: string;
  className?: string;
}

export function ShareButton({ copyUrl, tweetText, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}&url=${encodeURIComponent(copyUrl)}`;

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
