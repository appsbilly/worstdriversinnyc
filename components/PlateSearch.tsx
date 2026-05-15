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

  const isHero = size === "hero";
  const fieldH = isHero ? "h-14" : "h-12";

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-0 md:flex-row md:items-stretch md:border-2 md:border-foreground/85 md:bg-background">
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className={cn(
            "border-2 border-foreground/85 md:border-0 md:border-r-2 bg-background px-3 text-[11px] uppercase tracking-[0.18em] font-medium focus:outline-none focus:bg-foreground focus:text-background md:w-28",
            fieldH,
          )}
          aria-label="state"
        >
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code} className="normal-case tracking-normal">
              {s.code}
            </option>
          ))}
        </select>
        <input
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="ABC1234"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={10}
          className={cn(
            "flex-1 mt-2 md:mt-0 border-2 border-foreground/85 md:border-0 bg-background px-4 font-mono uppercase tracking-[0.18em] placeholder:text-muted-foreground/50 focus:outline-none focus:bg-foreground/5",
            fieldH,
            isHero ? "text-2xl font-bold" : "text-lg font-bold",
          )}
          aria-label="license plate"
        />
        <button
          type="submit"
          disabled={loading}
          className={cn(
            "mt-2 md:mt-0 bg-foreground px-6 text-[11px] uppercase tracking-[0.22em] font-bold text-background transition hover:bg-accent disabled:opacity-50",
            fieldH,
          )}
        >
          {loading ? "…" : "look it up →"}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-danger italic">{error}</p>
      ) : (
        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          any state's plate · we don't store searches
        </p>
      )}
    </form>
  );
}
