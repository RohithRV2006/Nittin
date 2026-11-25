import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

export default function OwnerDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        subtitle="Daily commercial pulse, stock health, production variances, and receivables"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Orders" value="0" />
        <StatCard label="Finished Goods Stock" value="0 pkts" />
        <StatCard label="Variance Alerts" value="0" />
        <StatCard label="Total Receivables" value="₹0.00" />
      </div>
    </div>
  );
}
