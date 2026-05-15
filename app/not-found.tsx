import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container max-w-xl py-24 text-center">
      <div className="eyebrow">404</div>
      <h1 className="display mt-3 text-[clamp(3rem,9vw,7rem)]">
        page not <span className="italic">found.</span>
      </h1>
      <p className="dek mt-4">the page you're looking for doesn't exist.</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center bg-foreground px-5 text-[11px] uppercase tracking-[0.22em] font-bold text-background hover:bg-accent"
      >
        ← back home
      </Link>
    </div>
  );
}
