"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const AUDITOR_TABS = [
  { href: "/auditor", label: "Overview" },
  { href: "/auditor/sales-register", label: "Sales Register" },
  { href: "/auditor/gst-summary", label: "GST Summary" },
  { href: "/auditor/purchase-register", label: "Purchase Register" },
  { href: "/auditor/stock-ledger", label: "Stock Ledger" },
  { href: "/auditor/production-report", label: "Production Report" },
  { href: "/auditor/receivables", label: "Receivables" },
  { href: "/auditor/audit-log", label: "Audit Trail" },
];

export function AuditorFilterBar({
  from,
  to,
  exportActions,
}: {
  from: string;
  to: string;
  exportActions?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  const applyRange = (nextFrom: string, nextTo: string) => {
    const qs = new URLSearchParams({ from: nextFrom, to: nextTo });
    router.push(`${pathname}?${qs.toString()}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyRange(fromVal, toVal);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 border-b border-[var(--border-default)] pb-3">
        {AUDITOR_TABS.map((t) => {
          const active = pathname === t.href;
          const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
          return (
            <Link
              key={t.href}
              href={`${t.href}${qs}`}
              className={`min-h-[34px] rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-[var(--brand-primary)] text-white"
                  : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 sm:flex-row sm:items-end sm:justify-between">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2.5">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              From Date
            </label>
            <input
              type="date"
              value={fromVal}
              onChange={(e) => setFromVal(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              To Date
            </label>
            <input
              type="date"
              value={toVal}
              onChange={(e) => setToVal(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
          <button
            type="submit"
            className="h-9 rounded-lg bg-[var(--brand-primary)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--brand-hover)]"
          >
            Apply Range
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const fyStartYear =
                now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
              const fyFrom = `${fyStartYear}-04-01`;
              const fyTo = now.toISOString().slice(0, 10);
              setFromVal(fyFrom);
              setToVal(fyTo);
              applyRange(fyFrom, fyTo);
            }}
            className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            Full FY
          </button>
        </form>

        {exportActions ? (
          <div className="flex flex-wrap items-center gap-2">{exportActions}</div>
        ) : null}
      </div>
    </div>
  );
}
