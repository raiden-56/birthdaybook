import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="font-display text-5xl font-semibold text-plum">404</p>
      <p className="mt-2 text-ink-muted">That page isn&apos;t in the book.</p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-plum px-4 font-medium text-on-plum">
        Back to today
      </Link>
    </div>
  );
}
