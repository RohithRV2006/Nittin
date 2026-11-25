import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function SalesmanOrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders & Customer-Wise Sales"
        subtitle="Track order status and customer-level bookings"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Order history, status filters, and customer-wise sales summaries will be wired here next.
      </InlineAlert>
    </div>
  );
}
