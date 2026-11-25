import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AuditorGstSummaryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="GST Summary (GSTR-1 / GSTR-3B)"
        subtitle="B2B, B2C, Credit Notes, and CGST / SGST / IGST rate breakdown"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Statutory GST outward supplies summary and exports will be wired here next.
      </InlineAlert>
    </div>
  );
}
