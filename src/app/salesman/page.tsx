import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

export default function SalesmanHomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Salesman Hub"
        subtitle="Field order capture & recent bookings"
        actions={
          <Link
            href="/salesman/new-order"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-[#047857] px-4 text-sm font-semibold text-white hover:bg-[#065F46]"
          >
            + New Field Order
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Today's Orders" value="0" />
        <StatCard label="Today's Booked Value" value="₹0.00" />
        <StatCard label="Active Customers" value="0" />
      </div>
    </div>
  );
}
