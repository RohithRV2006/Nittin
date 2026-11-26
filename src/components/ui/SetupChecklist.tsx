import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

export interface SetupChecklistItem {
  id: string;
  label: string;
  done: boolean;
  href?: string;
  actionLabel?: string;
}

export function SetupChecklist({
  title = "Factory Onboarding Progress",
  items,
}: {
  title?: string;
  items: SetupChecklistItem[];
}) {
  const completed = items.filter((i) => i.done).length;
  if (completed === items.length) return null;

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/30 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        <span className="rounded-full border border-amber-300 bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:border-amber-700 dark:text-amber-300">
          {completed} / {items.length} Completed
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              )}
              <span
                className={`truncate font-medium ${
                  item.done
                    ? "text-[var(--text-muted)] line-through"
                    : "text-[var(--text-primary)]"
                }`}
              >
                {item.label}
              </span>
            </div>
            {!item.done && item.href ? (
              <Link
                href={item.href}
                className="shrink-0 font-semibold text-[var(--brand-primary)] hover:underline"
              >
                {item.actionLabel ?? "Open →"}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
