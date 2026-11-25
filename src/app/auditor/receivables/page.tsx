import { PageHeader } from "@/components/ui/PageHeader";
import { InlineAlert } from "@/components/ui/InlineAlert";

export default function AuditorReceivablesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments, Collections & Receivables Ageing"
        subtitle="Customer balances across 0-30, 31-60, 61-90, and 90+ day buckets"
      />
      <InlineAlert variant="info" title="Module Ready for Feature Buildout">
        Debtors ageing analysis and collections register will be wired here next.
      </InlineAlert>
    </div>
  );
}
