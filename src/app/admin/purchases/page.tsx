import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AdminPurchasesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inward Procurement & Supplier Bills"
        subtitle="Record raw material & packaging receipts into FIFO stock batches"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Supplier bill inwarding and vendor payment recording will be wired here next.
      </InlineAlert>
    </div>
  );
}
