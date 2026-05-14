import Link from "next/link";
import { cn } from "@/lib/utils";

interface WindowTabsProps {
  basePath: string;
  windows: { value: string; label: string }[];
  active: string;
}

export function WindowTabs({ basePath, windows, active }: WindowTabsProps) {
  return (
    <div
      className="inline-flex rounded-md border border-border bg-background p-1"
      role="tablist"
    >
      {windows.map((w) => {
        const isActive = w.value === active;
        return (
          <Link
            key={w.value}
            href={`${basePath}?window=${w.value}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition",
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {w.label}
          </Link>
        );
      })}
    </div>
  );
}
