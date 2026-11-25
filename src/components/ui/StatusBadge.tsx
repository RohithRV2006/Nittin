type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_MAP: Record<string, { label: string; variant: StatusVariant }> = {
  SUBMITTED: { label: "Submitted", variant: "info" },
  APPROVED: { label: "Approved", variant: "info" },
  INVOICED: { label: "Invoiced", variant: "info" },
  POSTED: { label: "Posted", variant: "info" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  PENDING_DISPATCH: { label: "Pending Dispatch", variant: "warning" },
  PARTIALLY_DISPATCHED: { label: "Partial Dispatch", variant: "warning" },
  PENDING_BILLING: { label: "Pending Billing", variant: "warning" },
  ON_HOLD: { label: "On Hold", variant: "warning" },
  PARTIAL: { label: "Partial", variant: "warning" },
  DISPATCHED: { label: "Dispatched", variant: "success" },
  VERIFIED: { label: "Verified", variant: "success" },
  COMPLETED: { label: "Completed", variant: "success" },
  PAID: { label: "Paid", variant: "success" },
  SALES_RETURN: { label: "Sales Return", variant: "info" },
  SUFFICIENT: { label: "Sufficient", variant: "success" },
  NORMAL: { label: "Within Tolerance", variant: "success" },
  REJECTED: { label: "Rejected", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "danger" },
  UNPAID: { label: "Unpaid", variant: "danger" },
  FLAGGED: { label: "Variance Flagged", variant: "danger" },
  SHORTAGE: { label: "Shortage", variant: "danger" },
};

const VARIANT_STYLES: Record<StatusVariant, string> = {
  success:
    "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D] dark:border-[#166534] dark:bg-[#052E16] dark:text-[#4ADE80]",
  warning:
    "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FBBF24]",
  danger:
    "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] dark:border-[#991B1B] dark:bg-[#450A0A] dark:text-[#F87171]",
  info:
    "border-[#FDE68A] bg-[#FEF3C7] text-[#78350F] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FCD34D]",
  neutral:
    "border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
};

export function StatusBadge({
  status,
  customLabel,
}: {
  status: string;
  customLabel?: string;
}) {
  const mapped = STATUS_MAP[status] ?? { label: status, variant: "neutral" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
        VARIANT_STYLES[mapped.variant]
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {customLabel ?? mapped.label}
    </span>
  );
}
