import type { Metadata } from "next";
import Image from "next/image";
import { isDemoModeEnabled } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Nittin Order-to-Audit Manufacturing ERP.",
};

export default function LoginPage() {
  const demoMode = isDemoModeEnabled();

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-[0_1px_2px_rgba(35,23,15,0.06)] sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/nittin.png"
            alt="Nittin Snacks Logo"
            width={48}
            height={48}
            unoptimized
            className="h-12 w-12 rounded-full object-cover"
            priority
          />
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Nittin ERP
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Order-to-Audit Manufacturing
            </p>
          </div>
        </div>

        <LoginForm demoMode={demoMode} />
      </div>
    </main>
  );
}
