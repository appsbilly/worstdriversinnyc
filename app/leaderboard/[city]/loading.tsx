export default function Loading() {
  return (
    <div className="container max-w-5xl py-10">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-10 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mt-8 rounded-xl border border-border">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-10 border-t border-border first:border-t-0 animate-pulse bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
