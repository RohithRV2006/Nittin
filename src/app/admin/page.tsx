import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

export default function AdminCommandCenterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Factory Admin Command Center"
        subtitle="Incoming orders, billing, dispatch, procurement, and collections"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending Verification" value="0" />
        <StatCard label="Pending Dispatch" value="0" />
        <StatCard label="Today's Invoiced" value="₹0.00" />
        <StatCard label="Today's Collections" value="₹0.00" />
      </div>
    </div>
  );
}
