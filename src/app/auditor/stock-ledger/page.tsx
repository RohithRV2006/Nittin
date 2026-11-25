import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AuditorStockLedgerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Summary & Movement Ledger"
        subtitle="Opening, inward, outward, closing balances and FIFO batch reconciliation"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Immutable stock ledger, category/SKU filters, and reconciliation check will be wired here next.
      </InlineAlert>
    </div>
  );
}
