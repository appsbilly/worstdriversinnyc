"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidPlate, normalizePlate, normalizeState } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PlateSearchProps {
  defaultState?: string;
  size?: "default" | "hero";
}

const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "PR", name: "Puerto Rico" },
];

export function PlateSearch({
  defaultState = "NY",
  size = "default",
}: PlateSearchProps) {
  const router = useRouter();
  const [state, setState] = useState(defaultState);
  const [plate, setPlate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const p = normalizePlate(plate);
    const s = normalizeState(state);
    if (!isValidPlate(p)) {
      setError("enter a plate between 2 and 10 characters.");
      return;
    }
    if (s.length !== 2) {
      setError("state must be 2 letters.");
      return;
    }
    setLoading(true);
    router.push(`/lookup/nyc/${s}/${p}`);
  }

  // Plate input gets bigger type than other fields — it should look like a plate
  // when you type into it. State select and button stay at the same height but
  // use restrained UI-text sizes so the plate feels like the focal point.
  const fieldHeight = size === "hero" ? "h-16" : "h-12";

  return (
    <form onSubmit={submit} className="w-full">
      {/* On mobile: state + plate sit side-by-side (visually like a real plate),
          button stacks below at full width. On desktop: all three inline. */}
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <div className="flex gap-2 md:contents">
          {/* state select with explicit chevron so it's clearly tappable */}
          <div className={cn("relative shrink-0", size === "hero" ? "w-24" : "w-20", "md:w-28")}>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={cn(
                "w-full appearance-none rounded-md border border-border bg-background pl-3 pr-9 uppercase font-mono font-black focus:outline-none focus:ring-2 focus:ring-accent/40",
                fieldHeight,
                size === "hero" ? "text-3xl tracking-[0.08em]" : "text-xl tracking-[0.08em]",
              )}
              aria-label="state"
            >
              {US_STATES.map((s) => (
                <option
                  key={s.code}
                  value={s.code}
                  className="font-sans font-normal text-base tracking-normal"
                  title={s.name}
                >
                  {s.code}
                </option>
              ))}
            </select>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="ABC1234"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={10}
            className={cn(
              "flex-1 min-w-0 rounded-md border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 uppercase",
              fieldHeight,
              "font-mono font-black tracking-[0.18em] px-4",
              size === "hero" ? "text-3xl" : "text-xl",
            )}
            aria-label="license plate"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={cn(
            "rounded-md bg-foreground px-6 text-sm font-bold uppercase tracking-wider text-background transition hover:bg-accent disabled:opacity-50",
            fieldHeight,
          )}
        >
          {loading ? "..." : "look it up"}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger">{error}</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          works for any state's plate. nyc tickets every plate it sees.
        </p>
      )}
    </form>
  );
}
