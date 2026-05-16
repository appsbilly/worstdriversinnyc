"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PlateFrame } from "./PlateFrame";
import { anonymizePlate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PlateRevealProps {
  plate: string;
  state: string;
  className?: string;
}

export function PlateReveal({ plate, state, className }: PlateRevealProps) {
  const [hidden, setHidden] = useState(false);
  const displayPlate = hidden ? anonymizePlate(plate) : plate;
  return (
    <div className={cn("relative inline-flex", className)}>
      <PlateFrame plate={displayPlate} state={state} />
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        aria-label={hidden ? "show plate" : "hide plate"}
        title={hidden ? "show plate" : "hide plate"}
        data-capture-skip
        className="absolute -top-2 -right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground hover:border-foreground/40"
      >
        {hidden ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
      </button>
    </div>
  );
}
