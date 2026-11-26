import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface WorkflowStep {
  step: number;
  title: string;
  countLabel: string;
  hint: string;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success";
}

const TONE_BADGE: Record<NonNullable<WorkflowStep["tone"]>, string> = {
  default:
    "border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-primary)]",
  warning:
    "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FBBF24]",
  danger:
    "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] dark:border-[#991B1B] dark:bg-[#450A0A] dark:text-[#F87171]",
  success:
    "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D] dark:border-[#166534] dark:bg-[#052E16] dark:text-[#4ADE80]",
};

export function WorkflowPipeline({
  title,
  steps,
}: {
  title: string;
  steps: WorkflowStep[];
}) {
  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 lg:flex lg:items-stretch lg:gap-2">
        {steps.map((s, idx) => {
          const badgeCls = TONE_BADGE[s.tone ?? "default"];
          const cardBody = (
            <div className="flex h-full flex-col justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-canvas)]/60 p-3 transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-soft)]/30">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {s.step}. {s.title}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap ${badgeCls}`}
                >
                  {s.countLabel}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">{s.hint}</p>
            </div>
          );

          return (
            <div key={s.step} className="flex items-center gap-2 lg:flex-1">
              {s.href ? (
                <Link href={s.href} className="block h-full w-full">
                  {cardBody}
                </Link>
              ) : (
                <div className="h-full w-full">{cardBody}</div>
              )}
              {idx < steps.length - 1 ? (
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-[var(--text-muted)] lg:block" />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
