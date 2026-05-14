import { cn } from "@/lib/utils";

interface PlateFrameProps {
  plate: string;
  state: string;
  className?: string;
}

export function PlateFrame({ plate, state, className }: PlateFrameProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center rounded-lg border-4 border-foreground/90 bg-white px-6 py-3 shadow-sm",
        state === "NY" && "border-[#FF6B35]",
        className,
      )}
      style={{
        backgroundImage: "linear-gradient(180deg,#fefefe 0%,#ececec 100%)",
      }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/70">
        {state}
      </span>
      <span className="font-mono text-3xl font-black tracking-[0.18em] text-black md:text-4xl">
        {plate}
      </span>
    </div>
  );
}
