import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

type AlertVariant = "info" | "success" | "warning" | "danger";

const STYLES: Record<AlertVariant, string> = {
  info: "border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]",
  success: "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]",
  warning: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
  danger: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
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
