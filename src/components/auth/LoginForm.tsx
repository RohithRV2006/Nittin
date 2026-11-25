"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { demoSwitchAction, loginAction } from "@/actions/auth.actions";

const DEMO_ACCOUNTS = [
  { email: "salesman.a@nittin-demo.local", label: "Salesman A (Mobile)" },
  { email: "salesman.b@nittin-demo.local", label: "Salesman B (Interstate)" },
  { email: "admin@nittin-demo.local", label: "Factory Admin (Desktop)" },
  { email: "supervisor@nittin-demo.local", label: "Floor Supervisor" },
  { email: "auditor@nittin-demo.local", label: "Auditor (Read-Only)" },
  { email: "owner@nittin-demo.local", label: "Business Owner" },
];

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [isSwitching, startTransition] = useTransition();
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.error]);

  const handleDemoLogin = (email: string) => {
    startTransition(async () => {
      const res = await demoSwitchAction(email);
      if (res?.error) toast.error(res.error);
    });
  };

  const handleResetDemo = async () => {
    if (
      !window.confirm(
        "Reset and load the Section 5 Benchmark Demo Dataset? This replaces current demo records."
      )
    ) {
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load benchmark dataset.");
      } else {
        toast.success("Section 5 benchmark dataset loaded.");
      }
    } catch {
      toast.error("Network error while resetting demo dataset.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@company.com"
            className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-base text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 sm:text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-base text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 sm:text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-hover)] disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {demoMode ? (
        <div className="border-t border-[var(--border-default)] pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Demo Access
            </span>
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={isResetting}
              className="text-xs font-medium text-[var(--brand-primary)] hover:underline disabled:opacity-60"
            >
              {isResetting ? "Resetting..." : "Load / Reset Benchmark Data"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((acct) => (
              <button
                key={acct.email}
                type="button"
                disabled={isSwitching}
                onClick={() => handleDemoLogin(acct.email)}
                className="min-h-[40px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-soft)] disabled:opacity-60"
              >
                {acct.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
