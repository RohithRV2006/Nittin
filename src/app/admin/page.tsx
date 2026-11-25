import type { Metadata } from "next";
import Link from "next/link";
import { DispatchStatus, InvoiceStatus, OrderStatus } from "@prisma/client";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { formatINR, qty } from "@/lib/decimal";
import { getItemStockMap } from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Command Center",
  description: "Incoming orders, GST billing, dispatch, procurement, and inventory.",
};

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
        dispatchStatus: {
          in: [DispatchStatus.PENDING_DISPATCH, DispatchStatus.PARTIALLY_DISPATCHED],
        },
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
        title="Admin Command Center"
        subtitle="Orders, billing, dispatch, procurement, and stock"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/orders"
              className="inline-flex h-10 items-center rounded-lg bg-[var(--brand-primary)] px-3.5 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
            >
              Incoming Orders
            </Link>
            <Link
              href="/admin/purchases"
              className="inline-flex h-10 items-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
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
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Orders Awaiting Verification
            </h2>
            <Link href="/admin/orders" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
              View All →
            </Link>
          </div>
          {pendingOrders.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--text-muted)]">All incoming orders are processed.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border-default)] text-sm">
              {pendingOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2 text-[var(--text-primary)]">
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

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Invoices Awaiting Dispatch
            </h2>
            <Link href="/admin/invoices" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
              Dispatch Desk →
            </Link>
          </div>
          {pendingDispatches.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--text-muted)]">No pending dispatches.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border-default)] text-sm">
              {pendingDispatches.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2 text-[var(--text-primary)]">
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

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Audit Activity</h2>
        {recentAudits.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            No actions logged yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border-default)] text-sm">
            {recentAudits.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div>
                  <span className="font-medium text-[var(--text-primary)]">{a.user.name}</span>{" "}
                  <span className="text-[var(--text-secondary)]">
                    {a.action.toLowerCase()}d {a.entityType}
                  </span>
                  {a.reason ? (
                    <span className="text-xs text-[var(--text-muted)]"> — {a.reason}</span>
                  ) : null}
                </div>
                <span className="font-mono text-xs text-[var(--text-muted)]">
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
