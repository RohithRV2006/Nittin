import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AuditorAuditLogPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        subtitle="Immutable record of order edits, invoice cancellations, stock adjustments, and user changes"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Filterable audit diff viewer will be wired here next.
      </InlineAlert>
    </div>
  );
}
