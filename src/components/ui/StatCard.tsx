import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger";

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: Tone;
  icon?: ReactNode;
}

const TONE_CLASSES: Record<Tone, string> = {
  default: "text-[var(--text-primary)]",
  success: "text-[#15803D] dark:text-[#4ADE80]",
  warning: "text-[#B45309] dark:text-[#FBBF24]",
  danger: "text-[#B91C1C] dark:text-[#F87171]",
};

export function StatCard({
  label,
  value,
  sublabel,
  tone = "default",
  icon,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[0_1px_2px_rgba(35,23,15,0.05)] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
        {icon ? <span className="text-[var(--text-muted)]">{icon}</span> : null}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${TONE_CLASSES[tone]}`}
      >
        {value}
      </div>
      {sublabel ? (
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{sublabel}</p>
      ) : null}
    </div>
  );
}
