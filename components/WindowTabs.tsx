import Link from "next/link";
import { cn } from "@/lib/utils";

interface WindowTabsProps {
  basePath: string;
  windows: { value: string; label: string }[];
  active: string;
  /** Optional anchor appended to each tab link so the page scrolls back to a known section on nav. */
  hash?: string;
}

export function WindowTabs({ basePath, windows, active, hash }: WindowTabsProps) {
  return (
    <div
      className="inline-flex max-w-full overflow-x-auto rounded-md border border-border bg-background p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
    >
      {windows.map((w) => {
        const isActive = w.value === active;
        const href = `${basePath}?window=${w.value}${hash ? `#${hash}` : ""}`;
        return (
          <Link
            key={w.value}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "shrink-0 rounded px-3 py-2 text-xs font-medium uppercase tracking-wider transition whitespace-nowrap",
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
