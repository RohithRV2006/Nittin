"use client";

import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { PlusCircle } from "lucide-react";
import { OfflineSyncBanner } from "@/components/salesman/OfflineSyncBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/decimal";

export interface SalesmanHomeData {
  salesmanName: string;
  todayOrderCount: number;
  todayBookedValue: string;
  activeCustomersCount: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    orderDate: string;
    totalAmount: string;
    status: OrderStatus;
    itemCount: number;
  }>;
}

export function SalesmanHomeClient({ data }: { data: SalesmanHomeData }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${data.salesmanName}`}
        subtitle="Fast field order capture & live dispatch tracking"
        actions={
          <Link
            href="/salesman/new-order"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#047857] px-4 text-sm font-semibold text-white hover:bg-[#065F46]"
          >
            <PlusCircle className="h-4 w-4" />
            New Field Order
          </Link>
        }
      />

      <OfflineSyncBanner />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Today's Orders" value={data.todayOrderCount} />
        <StatCard
          label="Today's Booked Value"
          value={formatINR(data.todayBookedValue)}
          tone="success"
        />
        <StatCard label="Active Customers" value={data.activeCustomersCount} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0F172A]">Recent Orders</h2>
          <Link
            href="/salesman/orders"
            className="text-xs font-semibold text-[#047857] hover:underline"
          >
            View All & Customer Sales →
          </Link>
        </div>

        {data.recentOrders.length === 0 ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-10 text-center">
            <p className="text-sm font-medium text-[#0F172A]">No orders submitted yet</p>
            <p className="mt-1 text-xs text-[#64748B]">
              Tap &ldquo;New Field Order&rdquo; to book your first customer order.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.recentOrders.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#0F172A]">
                      {o.orderNumber}
                    </span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-[#0F172A]">
                    {o.customerName}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    {o.orderDate} • {o.itemCount} SKU(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold tabular-nums text-[#0F172A]">
                    {formatINR(o.totalAmount)}
                  </p>
                  <p className="text-[11px] text-[#64748B]">Pre-tax</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
