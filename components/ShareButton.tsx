"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  url: string;
  text: string;
  className?: string;
}

export function ShareButton({ url, text, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text,
  )}&url=${encodeURIComponent(url)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <a
        href={tweetIntent}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 items-center justify-center bg-foreground px-5 text-[11px] uppercase tracking-[0.22em] font-bold text-background hover:bg-accent transition-colors"
      >
        tweet this →
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-11 items-center justify-center border-2 border-foreground/85 px-5 text-[11px] uppercase tracking-[0.22em] font-bold text-foreground hover:bg-foreground hover:text-background transition-colors"
      >
        {copied ? "copied" : "copy link"}
      </button>
    </div>
  );
}
