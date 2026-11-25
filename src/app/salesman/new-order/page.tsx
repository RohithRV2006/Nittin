import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function SalesmanNewOrderPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Field Order"
        subtitle="Select customer, enter packet quantities, and submit directly to the factory"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Mobile order capture with offline IndexedDB sync and customer pricing will be wired here next.
      </InlineAlert>
    </div>
  );
}
