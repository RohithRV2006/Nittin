import type { Metadata } from "next";
import Link from "next/link";
import {
  DispatchStatus,
  GrnStatus,
  InvoiceStatus,
  ItemCategory,
  OrderStatus,
  PaymentStatus,
  ProductionRunStatus,
  Role,
} from "@prisma/client";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { SetupChecklist } from "@/components/ui/SetupChecklist";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkflowPipeline } from "@/components/ui/WorkflowPipeline";
import { formatINR, money, percent, qty } from "@/lib/decimal";
import { getItemStockMap } from "@/lib/engines/stock";
import { formatDisplayQty } from "@/lib/enums";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import { prisma, withDbRetry } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Executive Overview",
  description: "Live operations pipeline, unit economics, watchlists, and recent activity.",
};

export default async function OwnerDashboardPage() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const soonCutoff = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const [
    settings,
    adminCount,
    activeBomCount,
    todayOrdersCount,
    todayInvoices,
    todayPayments,
    monthInvoices,
    monthPurchases,
    items,
    stockMap,
    expiringBatches,
    recentRuns,
    postedInvoices,
    customers,
    pendingOrdersCount,
    pendingDispatchCount,
    inProgressRunsCount,
    pendingGrnsCount,
    recentAudits,
  ] = await withDbRetry(() =>
    Promise.all([
      prisma.companySettings.findUnique({ where: { id: "default" } }),
      prisma.user.count({ where: { role: Role.FACTORY_ADMIN, active: true } }),
      prisma.bOM.count({ where: { active: true } }),
      prisma.order.count({ where: { orderDate: { gte: startOfDay } } }),
      prisma.invoice.aggregate({
        where: { status: InvoiceStatus.POSTED, invoiceDate: { gte: startOfDay } },
        _sum: { totalAmount: true },
      }),
      prisma.payment.aggregate({
        where: { paymentDate: { gte: startOfDay } },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { status: InvoiceStatus.POSTED, invoiceDate: { gte: startOfMonth } },
        _sum: { totalAmount: true },
      }),
      prisma.purchase.aggregate({
        where: { purchaseDate: { gte: startOfMonth } },
        _sum: { totalAmount: true },
      }),
      prisma.item.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      getItemStockMap(prisma),
      prisma.stockBatch.findMany({
        where: {
          remainingQty: { gt: 0 },
          expiryDate: { lte: soonCutoff },
        },
        include: { item: { select: { name: true, unit: true } } },
      }),
      prisma.productionRun.findMany({
        where: { status: ProductionRunStatus.COMPLETED },
        orderBy: { runDate: "desc" },
        take: 10,
        include: {
          bom: {
            include: {
              finishedItem: {
                select: { name: true, sellingPrice: true, unit: true },
              },
            },
          },
        },
      }),
      prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.POSTED,
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
        },
        select: {
          customerId: true,
          totalAmount: true,
          paidAmount: true,
          creditNotes: { select: { amount: true } },
        },
      }),
      prisma.customer.findMany({
        where: { active: true },
        select: { id: true, name: true, state: true },
      }),
      prisma.order.count({
        where: {
          status: { in: [OrderStatus.SUBMITTED, OrderStatus.ON_HOLD, OrderStatus.APPROVED] },
        },
      }),
      prisma.invoice.count({
        where: {
          status: InvoiceStatus.POSTED,
          dispatchStatus: {
            in: [DispatchStatus.PENDING_DISPATCH, DispatchStatus.PARTIALLY_DISPATCHED],
          },
        },
      }),
      prisma.productionRun.count({
        where: { status: ProductionRunStatus.IN_PROGRESS },
      }),
      prisma.goodsReceipt.count({
        where: { status: GrnStatus.PENDING_BILLING },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        include: { user: { select: { name: true, role: true } } },
      }),
    ])
  );

  const finishedItems = items.filter(
    (i) => i.category === ItemCategory.FINISHED_GOOD
  );
  let totalFinishedPackets = qty(0);
  for (const fg of finishedItems) {
    totalFinishedPackets = qty(
      totalFinishedPackets.plus(stockMap.get(fg.id) ?? qty(0))
    );
  }

  const prioritizedItems = [...items]
    .map((item) => {
      const bal = stockMap.get(item.id) ?? qty(0);
      const re = qty(item.reorderLevel.toString());
      const isLow = re.gt(0) && bal.lte(re);
      return { item, bal, isLow };
    })
    .sort((a, b) => Number(b.isLow) - Number(a.isLow));

  const lowStockCount = prioritizedItems.filter((x) => x.isLow).length;
  const varianceRuns = recentRuns.filter((r) => r.varianceFlagged);

  const latestRunWithCost = recentRuns.find((r) => r.costPerPacket !== null);
  const latestCost = latestRunWithCost?.costPerPacket
    ? money(latestRunWithCost.costPerPacket.toString())
    : null;
  const latestSelling = latestRunWithCost?.bom.finishedItem.sellingPrice
    ? money(latestRunWithCost.bom.finishedItem.sellingPrice.toString())
    : null;
  const latestMarginPct =
    latestCost && latestSelling && latestSelling.gt(0)
      ? percent(latestSelling.minus(latestCost).div(latestSelling).mul(100))
      : null;

  const dueByCustomer = new Map<string, ReturnType<typeof money>>();
  let totalReceivables = money(0);
  for (const inv of postedInvoices) {
    let cnSum = money(0);
    for (const cn of inv.creditNotes) {
      cnSum = money(cnSum.plus(cn.amount.toString()));
    }
    const due = money(inv.totalAmount.toString())
      .minus(cnSum)
      .minus(inv.paidAmount.toString());
    if (due.gt(0)) {
      totalReceivables = money(totalReceivables.plus(due));
      dueByCustomer.set(
        inv.customerId,
        money((dueByCustomer.get(inv.customerId) ?? money(0)).plus(due))
      );
    }
  }

  const topDebtors = customers
    .map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state,
      due: dueByCustomer.get(c.id) ?? money(0),
    }))
    .filter((d) => d.due.gt(0))
    .sort((a, b) => Number(b.due.minus(a.due)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Executive Overview"
          subtitle="Live operational health, commercial pulse, and priority alerts"
        />
        <div className="flex flex-wrap gap-2 self-start">
          <Link
            href="/dashboard/reports"
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand-primary)] px-3.5 text-xs font-semibold text-white transition hover:bg-[var(--brand-hover)]"
          >
            Analytics & Reports →
          </Link>
          <Link
            href="/dashboard/audit"
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-subtle)]"
          >
            Audit Trail
          </Link>
        </div>
      </div>

      <SetupChecklist
        title="Company Setup Readiness"
        items={[
          {
            id: "gst",
            label: "Company GST Profile",
            done: Boolean(settings?.isConfigured),
            href: "/dashboard/team",
            actionLabel: "Configure →",
          },
          {
            id: "admin",
            label: "Appoint Factory Admin",
            done: adminCount > 0,
            href: "/dashboard/team",
            actionLabel: "Create →",
          },
          {
            id: "catalog",
            label: "Items & Customers Added",
            done: items.length > 0 && customers.length > 0,
          },
          {
            id: "boms",
            label: "BOM Recipes Active",
            done: activeBomCount > 0,
          },
        ]}
      />

      {varianceRuns.length > 0 || expiringBatches.length > 0 ? (
        <InlineAlert
          variant={varianceRuns.length > 0 ? "danger" : "warning"}
          title="Operations Attention"
        >
          <div className="space-y-1 text-xs">
            {varianceRuns.length > 0 ? (
              <p>
                Variance alerts:{" "}
                {varianceRuns
                  .slice(0, 3)
                  .map((r) => `${r.runNumber} (${r.yieldVariancePercent.toFixed(1)}%)`)
                  .join(" • ")}
              </p>
            ) : null}
            {expiringBatches.length > 0 ? (
              <p>
                Expiring within 15 days:{" "}
                {expiringBatches
                  .slice(0, 3)
                  .map((b) => `${b.batchNumber} (${b.item.name})`)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        </InlineAlert>
      ) : null}

      <WorkflowPipeline
        title="Live Company Operations Flow"
        steps={[
          {
            step: 1,
            title: "Orders Pending",
            countLabel: `${pendingOrdersCount}`,
            hint: "Waiting Admin approval",
            tone: pendingOrdersCount > 0 ? "warning" : "success",
          },
          {
            step: 2,
            title: "Awaiting Dispatch",
            countLabel: `${pendingDispatchCount}`,
            hint: "Invoices pending shipment",
            tone: pendingDispatchCount > 0 ? "warning" : "success",
          },
          {
            step: 3,
            title: "Active Production",
            countLabel: `${inProgressRunsCount} running`,
            hint: `${recentRuns.length} completed recently`,
            tone: inProgressRunsCount > 0 ? "warning" : "default",
          },
          {
            step: 4,
            title: "Floor Gate GRNs",
            countLabel: `${pendingGrnsCount} pending`,
            hint: "Waiting Admin bill rates",
            tone: pendingGrnsCount > 0 ? "warning" : "default",
          },
          {
            step: 5,
            title: "Open Receivables",
            countLabel: formatINR(totalReceivables),
            hint: `${topDebtors.length} customer(s) due`,
            tone: totalReceivables.gt(0) ? "warning" : "success",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Commercial Pulse"
          value={`${todayOrdersCount} Orders`}
          sublabel={`Invoiced: ${formatINR(todayInvoices._sum.totalAmount?.toString() ?? "0")} • Paid: ${formatINR(todayPayments._sum.amount?.toString() ?? "0")}`}
        />
        <StatCard
          label="Month Sales vs. Purchases"
          value={formatINR(monthInvoices._sum.totalAmount?.toString() ?? "0")}
          sublabel={`Purchases (MTD): ${formatINR(monthPurchases._sum.totalAmount?.toString() ?? "0")}`}
        />
        <StatCard
          label="Finished Goods Stock"
          value={`${totalFinishedPackets.toFixed(0)} Units`}
          sublabel={`${finishedItems.length} finished SKU(s) active`}
        />
        <StatCard
          label="Latest Unit Economics"
          value={latestCost ? `${formatINR(latestCost)} / pkt` : "—"}
          sublabel={
            latestSelling && latestMarginPct
              ? `Sell: ${formatINR(latestSelling)} • Margin: ${latestMarginPct.toFixed(1)}%`
              : "Complete a production run to compute cost"
          }
          tone={latestMarginPct && latestMarginPct.gt(0) ? "success" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Stock Watchlist
            </h2>
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {lowStockCount > 0 ? `${lowStockCount} below reorder` : "Healthy levels"}
            </span>
          </div>
          <div className="mt-3 divide-y divide-[var(--border-default)] text-sm">
            {prioritizedItems.length === 0 ? (
              <p className="py-3 text-xs text-[var(--text-muted)]">
                No catalog items added yet.
              </p>
            ) : (
              prioritizedItems.slice(0, 6).map(({ item, bal, isLow }) => (
                <div key={item.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0 pr-2">
                    <span className="font-medium text-[var(--text-primary)]">{item.name}</span>{" "}
                    <span className="font-mono text-xs text-[var(--text-muted)]">({item.code})</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums font-semibold text-[var(--text-primary)]">
                      {formatDisplayQty(bal.toString(), item.unit)} {item.unit}
                    </span>
                    {isLow ? <StatusBadge status="ON_HOLD" customLabel="Low" /> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Outstanding Customer Dues
              </h2>
              <span className="text-xs font-medium text-[var(--text-muted)]">Top Debtors</span>
            </div>
            {topDebtors.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                No outstanding customer balances.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-[var(--border-default)] text-sm">
                {topDebtors.slice(0, 4).map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2">
                    <span className="text-[var(--text-primary)]">
                      {d.name} <span className="text-xs text-[var(--text-muted)]">({d.state})</span>
                    </span>
                    <span className="tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                      {formatINR(d.due)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Recent Batch Costing
              </h2>
              <Link
                href="/dashboard/reports"
                className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
              >
                Full analytics →
              </Link>
            </div>
            {recentRuns.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                No completed production runs yet.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-[var(--border-default)] text-sm">
                {recentRuns.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2">
                    <div className="truncate pr-2 text-[var(--text-primary)]">
                      <span className="font-mono text-xs font-semibold">{r.runNumber}</span> —{" "}
                      {r.bom.finishedItem.name}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 tabular-nums">
                      <span className="text-xs text-[var(--text-secondary)]">
                        {r.costPerPacket ? `${formatINR(r.costPerPacket)}/pkt` : "N/A"}
                      </span>
                      <StatusBadge
                        status={r.varianceFlagged ? "FLAGGED" : "NORMAL"}
                        customLabel={`${r.yieldVariancePercent.toFixed(1)}%`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Compact Recent Activity Preview */}
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Recent Activity Highlights
            </h2>
            <p className="text-xs text-[var(--text-muted)]">Latest 4 recorded actions across portals</p>
          </div>
          <Link
            href="/dashboard/audit"
            className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
          >
            Open Audit Trail →
          </Link>
        </div>
        {recentAudits.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--text-muted)]">No activity recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border-default)] text-sm">
            {recentAudits.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-medium text-[var(--text-primary)]">{a.user.name}</span>{" "}
                  <span className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                    {ROLE_LABELS[a.user.role as UserRole]}
                  </span>{" "}
                  <span className="text-[var(--text-secondary)]">
                    {a.action.toLowerCase()} {a.entityType.replace("_", " ").toLowerCase()}
                  </span>
                </div>
                <span className="font-mono text-xs text-[var(--text-muted)]">
                  {a.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
