import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AuditorPurchaseRegisterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Register"
        subtitle="Inward supplier bills, taxable value, and input GST credits"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Purchase register with supplier GSTIN filters and Excel/CSV/PDF/Tally exports will be wired here next.
      </InlineAlert>
    </div>
  );
}
