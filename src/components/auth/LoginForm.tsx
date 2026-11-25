"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  demoSwitchAction,
  loginAction,
  requestPasswordResetAction,
} from "@/actions/auth.actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PasswordInput } from "@/components/ui/PasswordInput";

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
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPending, startForgotTransition] = useTransition();

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
    setIsResetting(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load benchmark dataset.");
      } else {
        toast.success("Section 5 benchmark dataset loaded.");
        setResetDialogOpen(false);
      }
    } catch {
      toast.error("Network error while resetting demo dataset.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startForgotTransition(async () => {
      const res = await requestPasswordResetAction(forgotEmail);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to submit reset request.");
        return;
      }
      toast.success(
        res.message ??
          "Password reset request sent. Ask your Factory Admin for a temporary password."
      );
      setForgotEmail("");
      setForgotMode(false);
    });
  };

  return (
    <div className="space-y-5">
      {forgotMode ? (
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)]">
            Enter your registered work email to notify your Factory Admin to issue a temporary password reset.
          </div>
          <div>
            <label
              htmlFor="forgot-email"
              className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Work Email Address
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@company.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-base text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 sm:text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForgotMode(false)}
              className="h-11 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              Back to Sign In
            </button>
            <button
              type="submit"
              disabled={forgotPending}
              className="h-11 flex-1 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-hover)] disabled:opacity-60"
            >
              {forgotPending ? "Sending..." : "Request Reset"}
            </button>
          </div>
        </form>
      ) : (
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
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setForgotMode(true)}
                className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <PasswordInput
              id="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-11 text-base sm:text-sm"
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
      )}

      {demoMode ? (
        <div className="border-t border-[var(--border-default)] pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Demo Access
            </span>
            <button
              type="button"
              onClick={() => setResetDialogOpen(true)}
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

      <ConfirmDialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        onConfirm={handleResetDemo}
        loading={isResetting}
        title="Load Section 5 Benchmark Dataset"
        description="This will replace current demo records with the Section 5 benchmark dataset. Production data is unaffected when ENABLE_DEMO_MODE is isolated."
        confirmLabel="Load Dataset"
      />
    </div>
  );
}
