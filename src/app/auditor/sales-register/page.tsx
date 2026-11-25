import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AuditorSalesRegisterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Register"
        subtitle="Invoice-wise, customer-wise, and product-wise outward supplies"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Date-filtered sales register with Excel, CSV, PDF, and Tally XML/Excel exports will be wired here next.
      </InlineAlert>
    </div>
  );
}
