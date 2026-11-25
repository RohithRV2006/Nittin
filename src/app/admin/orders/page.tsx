import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Incoming Order Verification"
        subtitle="Review field orders, check finished goods stock, and raise GST invoices"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Order verification queue, stock sufficiency alerts, and quantity/price override workflow will be wired here next.
      </InlineAlert>
    </div>
  );
}
