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
  default: "text-[#0F172A]",
  success: "text-[#15803D]",
  warning: "text-[#B45309]",
  danger: "text-[#B91C1C]",
};

export function StatCard({
  label,
  value,
  sublabel,
  tone = "default",
  icon,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-[#64748B]">
          {label}
        </span>
        {icon ? <span className="text-[#64748B]">{icon}</span> : null}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${TONE_CLASSES[tone]}`}
      >
        {value}
      </div>
      {sublabel ? (
        <p className="mt-1 text-xs text-[#475569]">{sublabel}</p>
      ) : null}
    </div>
  );
}
