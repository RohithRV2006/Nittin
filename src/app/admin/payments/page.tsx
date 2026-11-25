import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AdminPaymentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Collections & Receivables"
        subtitle="Record customer payments and track invoice settlements"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Customer payment logging, invoice allocation, and receipt vouchers will be wired here next.
      </InlineAlert>
    </div>
  );
}
