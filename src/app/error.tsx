"use client";

import Image from "next/image";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          Something went wrong
        </h1>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {error.message || "An unexpected error occurred while processing your request."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-9 rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white hover:bg-[var(--brand-hover)]"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border-strong)] px-4 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
