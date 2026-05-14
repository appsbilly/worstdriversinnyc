"use client";

import { listCities } from "@/lib/cities";
import { cn } from "@/lib/utils";

interface CityPickerProps {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function CityPicker({ value, onChange, className }: CityPickerProps) {
  const cities = listCities();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-12 rounded-md border border-border bg-background px-3 text-sm",
        className,
      )}
      aria-label="city"
    >
      {cities.map((c) => (
        <option key={c.id} value={c.id}>
          {c.shortName}
          {c.enabled ? "" : " (soon)"}
        </option>
      ))}
    </select>
  );
}
