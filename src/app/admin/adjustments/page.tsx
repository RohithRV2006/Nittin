import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AdminAdjustmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Adjustments & Expiry Alerts"
        subtitle="Inspect open FIFO/FEFO lots and record compensating stock adjustments"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Batch lot inspection, expiry warnings, and audited stock adjustments will be wired here next.
      </InlineAlert>
    </div>
  );
}
