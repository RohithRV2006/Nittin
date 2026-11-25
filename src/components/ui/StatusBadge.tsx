type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_MAP: Record<string, { label: string; variant: StatusVariant }> = {
  SUBMITTED: { label: "Submitted", variant: "info" },
  APPROVED: { label: "Approved", variant: "info" },
  INVOICED: { label: "Invoiced", variant: "info" },
  POSTED: { label: "Posted", variant: "info" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  PENDING_DISPATCH: { label: "Pending Dispatch", variant: "warning" },
  ON_HOLD: { label: "On Hold", variant: "warning" },
  PARTIAL: { label: "Partial", variant: "warning" },
  DISPATCHED: { label: "Dispatched", variant: "success" },
  COMPLETED: { label: "Completed", variant: "success" },
  PAID: { label: "Paid", variant: "success" },
  SUFFICIENT: { label: "Sufficient", variant: "success" },
  NORMAL: { label: "Within Tolerance", variant: "success" },
  REJECTED: { label: "Rejected", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "danger" },
  UNPAID: { label: "Unpaid", variant: "danger" },
  FLAGGED: { label: "Variance Flagged", variant: "danger" },
  SHORTAGE: { label: "Shortage", variant: "danger" },
};

const VARIANT_STYLES: Record<StatusVariant, string> = {
  success: "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]",
  warning: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
  danger: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
  info: "border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]",
  neutral: "border-[#E2E8F0] bg-[#F1F5F9] text-[#475569]",
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
