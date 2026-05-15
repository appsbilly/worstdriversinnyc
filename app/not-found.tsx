import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container max-w-xl py-20 text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="mt-2 font-serif text-5xl font-black tracking-tight">page not found.</h1>
      <p className="mt-3 text-muted-foreground">
        the page you're looking for doesn't exist.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        ← back home
      </Link>
    </div>
  );
}
