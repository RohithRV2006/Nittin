import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function ProductionNewRunPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Batch Run & Scrap Logger"
        subtitle="Issue materials against a BOM recipe and record actual output, wastage, and overheads"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Interactive BOM batch execution with live FIFO costing and ±3% variance alerts will be wired here next.
      </InlineAlert>
    </div>
  );
}
