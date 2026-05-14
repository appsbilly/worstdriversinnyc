export default function Loading() {
  return (
    <div className="container max-w-5xl py-10 md:py-12">
      <div className="h-3 w-12 animate-pulse rounded bg-muted" />
      <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-6 md:p-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4">
            <div className="h-16 w-44 animate-pulse rounded-lg bg-muted" />
            <div className="h-16 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-24 w-40 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">fetching from the city's data api...</p>
    </div>
  );
}
