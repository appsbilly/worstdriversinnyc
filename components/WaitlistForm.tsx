"use client";

import { useState } from "react";

interface WaitlistFormProps {
  city: string;
}

export function WaitlistForm({ city }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, city }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "something went wrong");
      }
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "something went wrong");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-md border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
        you're on the list. we'll email when {city} goes live.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {state === "loading" ? "..." : "notify me"}
      </button>
      {error ? <p className="text-xs text-danger sm:basis-full">{error}</p> : null}
    </form>
  );
}
