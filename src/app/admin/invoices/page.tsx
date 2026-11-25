import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AdminInvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="GST Invoicing & Dispatch Desk"
        subtitle="Download GST PDFs, share via WhatsApp, record dispatches, and export e-Invoice / e-Way JSON"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        GST tax invoice table, dispatch stock deductions, and credit note reversals will be wired here next.
      </InlineAlert>
    </div>
  );
}
