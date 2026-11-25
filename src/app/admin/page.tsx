import Link from "next/link";
import { DispatchStatus, InvoiceStatus, OrderStatus } from "@prisma/client";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { formatINR, qty } from "@/lib/decimal";
import { getItemStockMap } from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCommandCenterPage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    settings,
    pendingOrders,
    pendingDispatches,
    todayInvoices,
    todayPayments,
    items,
    stockMap,
    recentAudits,
  ] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.order.findMany({
      where: { status: { in: [OrderStatus.SUBMITTED, OrderStatus.ON_HOLD] } },
      orderBy: { orderDate: "desc" },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.POSTED,
        dispatchStatus: DispatchStatus.PENDING_DISPATCH,
      },
      orderBy: { invoiceDate: "desc" },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
    prisma.invoice.aggregate({
      where: { status: InvoiceStatus.POSTED, invoiceDate: { gte: startOfDay } },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: startOfDay } },
      _sum: { amount: true },
    }),
    prisma.item.findMany({ where: { active: true } }),
    getItemStockMap(prisma),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const lowStock = items.filter((i) => {
    const bal = stockMap.get(i.id) ?? qty(0);
    const re = qty(i.reorderLevel.toString());
    return re.gt(0) && bal.lte(re);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factory Admin Command Center"
        subtitle="Incoming orders, billing, dispatch, procurement, and inventory health"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/orders"
              className="inline-flex h-10 items-center rounded-lg bg-[#047857] px-3.5 text-sm font-semibold text-white hover:bg-[#065F46]"
            >
              Incoming Orders
            </Link>
            <Link
              href="/admin/purchases"
              className="inline-flex h-10 items-center rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-sm font-medium text-[#0F172A] hover:bg-[#F1F5F9]"
            >
              + Record Purchase
            </Link>
          </div>
        }
      />

      {!settings?.isConfigured ? (
        <InlineAlert variant="warning" title="Complete Initial Factory Setup">
          Your company GSTIN and state code are not configured yet.{" "}
          <Link href="/admin/masters" className="font-semibold underline">
            Configure Factory Profile →
          </Link>
        </InlineAlert>
      ) : null}

      {lowStock.length > 0 ? (
        <InlineAlert variant="warning" title="Low-Stock Items">
          {lowStock.map((i) => i.name).join(", ")} —{" "}
          <Link href="/admin/adjustments" className="font-semibold underline">
            View Stock Lots →
          </Link>
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending Verification"
          value={pendingOrders.length}
          tone={pendingOrders.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Pending Dispatch"
          value={pendingDispatches.length}
          tone={pendingDispatches.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Today's Invoiced"
          value={formatINR(todayInvoices._sum.totalAmount?.toString() ?? "0")}
        />
        <StatCard
          label="Today's Collections"
          value={formatINR(todayPayments._sum.amount?.toString() ?? "0")}
          tone="success"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Orders Awaiting Verification
            </h2>
            <Link href="/admin/orders" className="text-xs font-medium text-[#047857] hover:underline">
              View All →
            </Link>
          </div>
          {pendingOrders.length === 0 ? (
            <p className="mt-3 text-xs text-[#64748B]">All incoming orders are processed.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#F1F5F9] text-sm">
              {pendingOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="font-mono text-xs font-semibold">{o.orderNumber}</span>{" "}
                    — {o.customer.name}
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatINR(o.totalAmount.toString())}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Invoices Awaiting Dispatch
            </h2>
            <Link href="/admin/invoices" className="text-xs font-medium text-[#047857] hover:underline">
              Dispatch Desk →
            </Link>
          </div>
          {pendingDispatches.length === 0 ? (
            <p className="mt-3 text-xs text-[#64748B]">No pending dispatches.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#F1F5F9] text-sm">
              {pendingDispatches.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="font-mono text-xs font-semibold">{inv.invoiceNumber}</span>{" "}
                    — {inv.customer.name}
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatINR(inv.totalAmount.toString())}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#0F172A]">Recent Audit Activity</h2>
        {recentAudits.length === 0 ? (
          <p className="mt-2 text-xs text-[#64748B]">
            No actions logged yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#F1F5F9] text-sm">
            {recentAudits.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div>
                  <span className="font-medium text-[#0F172A]">{a.user.name}</span>{" "}
                  <span className="text-[#475569]">
                    {a.action.toLowerCase()}d {a.entityType}
                  </span>
                  {a.reason ? (
                    <span className="text-xs text-[#64748B]"> — {a.reason}</span>
                  ) : null}
                </div>
                <span className="font-mono text-xs text-[#64748B]">
                  {a.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
