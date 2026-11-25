import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

type AlertVariant = "info" | "success" | "warning" | "danger";

const STYLES: Record<AlertVariant, string> = {
  info: "border-[#FDE68A] bg-[#FFFBEB] text-[#78350F] dark:border-[#92400E] dark:bg-[#2B1907] dark:text-[#FDE68A]",
  success:
    "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D] dark:border-[#166534] dark:bg-[#052E16] dark:text-[#86EFAC]",
  warning:
    "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FCD34D]",
  danger:
    "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] dark:border-[#991B1B] dark:bg-[#450A0A] dark:text-[#FCA5A5]",
};

const ICONS: Record<AlertVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

export function InlineAlert({
  variant = "info",
  title,
  children,
}: {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
}) {
  const Icon = ICONS[variant];
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${STYLES[variant]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? "mt-0.5 text-xs sm:text-sm" : ""}>{children}</div>
      </div>
    </div>
  );
}
