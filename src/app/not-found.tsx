import Image from "next/image";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] px-4 text-center">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 shadow-sm">
        <Image
          src="/nittin.png"
          alt="Nittin Logo"
          width={48}
          height={48}
          unoptimized
          className="mx-auto mb-4 h-12 w-12 rounded-full object-cover"
        />
        <p className="font-mono text-xs font-semibold text-[var(--brand-primary)]">
          404 • PAGE NOT FOUND
        </p>
        <h1 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
          Page could not be found
        </h1>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          The requested route does not exist or your role does not have access to it.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white hover:bg-[var(--brand-hover)]"
        >
          Back to Portal
        </Link>
      </div>
    </main>
  );
}
