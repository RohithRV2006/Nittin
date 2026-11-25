import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AuditorProductionReportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Variance & Costing Report"
        subtitle="Planned vs actual material consumption, yield variance, scrap, and unit cost per packet"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Batch variance and unit economics report will be wired here next.
      </InlineAlert>
    </div>
  );
}
