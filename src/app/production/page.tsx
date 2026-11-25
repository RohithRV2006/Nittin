import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

export default function ProductionOverviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Floor Overview"
        subtitle="BOM recipes, batch run planning, and tolerance alerts"
        actions={
          <Link
            href="/production/new-run"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-[#047857] px-4 text-sm font-semibold text-white hover:bg-[#065F46]"
          >
            + Start Production Run
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active BOMs" value="0" />
        <StatCard label="In-Progress Runs" value="0" />
        <StatCard label="Variance Alerts (24h)" value="0" />
      </div>
    </div>
  );
}
