"use client";

import { useActionState, useState, useTransition } from "react";
import { demoSwitchAction, loginAction } from "@/actions/auth.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";

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
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [isSwitching, startTransition] = useTransition();
  const [isResetting, setIsResetting] = useState(false);

  const handleDemoLogin = (email: string) => {
    setDemoError(null);
    startTransition(async () => {
      const res = await demoSwitchAction(email);
      if (res?.error) setDemoError(res.error);
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
    setDemoError(null);
    setDemoMessage(null);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setDemoError(data.error || "Failed to reset benchmark dataset.");
      } else {
        setDemoMessage("Section 5 benchmark dataset loaded successfully.");
      }
    } catch {
      setDemoError("Network error while resetting demo dataset.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-5">
      {state?.error ? (
        <InlineAlert variant="danger">{state.error}</InlineAlert>
      ) : null}
      {demoError ? <InlineAlert variant="danger">{demoError}</InlineAlert> : null}
      {demoMessage ? (
        <InlineAlert variant="success">{demoMessage}</InlineAlert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-medium text-[#475569]"
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
            className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-base text-[#0F172A] outline-none transition focus:border-[#047857] focus:ring-2 focus:ring-[#047857]/20 sm:text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-medium text-[#475569]"
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
            className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-base text-[#0F172A] outline-none transition focus:border-[#047857] focus:ring-2 focus:ring-[#047857]/20 sm:text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-lg bg-[#047857] px-4 text-sm font-semibold text-white transition hover:bg-[#065F46] disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {demoMode ? (
        <div className="border-t border-[#E2E8F0] pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Demo Evaluation Section
            </span>
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={isResetting}
              className="text-xs font-medium text-[#047857] hover:underline disabled:opacity-60"
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
                className="min-h-[40px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-left text-xs font-medium text-[#0F172A] transition hover:border-[#047857] hover:bg-[#ECFDF5] disabled:opacity-60"
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
