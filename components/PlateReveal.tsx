"use client";

import { useState } from "react";
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
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <PlateFrame plate={displayPlate} state={state} />
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        className="inline-flex h-9 items-center px-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
      >
        {hidden ? "show plate" : "hide plate"}
      </button>
    </div>
  );
}
