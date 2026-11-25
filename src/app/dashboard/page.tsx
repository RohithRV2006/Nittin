import Link from "next/link";
import {
  InvoiceStatus,
  ItemCategory,
  OrderStatus,
  ProductionRunStatus,
} from "@prisma/client";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR, money, percent, qty } from "@/lib/decimal";
import { getItemStockMap } from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const soonCutoff = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

  const [
    todayOrdersCount,
    todayInvoices,
    todayPayments,
    items,
    stockMap,
    expiringBatches,
    recentRuns,
    postedInvoices,
    customers,
  ] = await Promise.all([
    prisma.order.count({ where: { orderDate: { gte: startOfDay } } }),
    prisma.invoice.aggregate({
      where: { status: InvoiceStatus.POSTED, invoiceDate: { gte: startOfDay } },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: startOfDay } },
      _sum: { amount: true },
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
      where: { status: InvoiceStatus.POSTED },
      select: { customerId: true, totalAmount: true, paidAmount: true },
    }),
    prisma.customer.findMany({
      where: { active: true },
      select: { id: true, name: true, state: true },
    }),
  ]);

  const finishedItems = items.filter(
    (i) => i.category === ItemCategory.FINISHED_GOOD
  );
  let totalFinishedPackets = qty(0);
  for (const fg of finishedItems) {
    totalFinishedPackets = qty(
      totalFinishedPackets.plus(stockMap.get(fg.id) ?? qty(0))
    );
  }

  const lowStockItems = items.filter((i) => {
    const bal = stockMap.get(i.id) ?? qty(0);
    const re = qty(i.reorderLevel.toString());
    return re.gt(0) && bal.lte(re);
  });

  const varianceRuns = recentRuns.filter((r) => r.varianceFlagged);

  // Latest completed run unit economics
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

  // Total receivables & top debtors
  const dueByCustomer = new Map<string, ReturnType<typeof money>>();
  let totalReceivables = money(0);
  for (const inv of postedInvoices) {
    const due = money(inv.totalAmount.toString()).minus(inv.paidAmount.toString());
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

  const pendingOrdersCount = await prisma.order.count({
    where: {
      status: { in: [OrderStatus.SUBMITTED, OrderStatus.ON_HOLD, OrderStatus.APPROVED] },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Owner Executive Dashboard"
        subtitle="Real-time commercial pulse, warehouse stock, production variance alerts, unit economics, and receivables"
        actions={
          <Link
            href="/auditor"
            className="inline-flex h-10 items-center rounded-lg border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#0F172A] hover:bg-[#F1F5F9]"
          >
            Audit Reports →
          </Link>
        }
      />

      {varianceRuns.length > 0 ? (
        <InlineAlert variant="danger" title="Production Variance Alerts">
          {varianceRuns
            .slice(0, 3)
            .map(
              (r) =>
                `${r.runNumber} (${r.bom.finishedItem.name}): Yield ${r.yieldVariancePercent.toFixed(2)}%`
            )
            .join(" • ")}
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Commercial Pulse"
          value={`${todayOrdersCount} Orders`}
          sublabel={`Invoiced: ${formatINR(todayInvoices._sum.totalAmount?.toString() ?? "0")} • Paid: ${formatINR(todayPayments._sum.amount?.toString() ?? "0")}`}
        />
        <StatCard
          label="Finished Goods Stock"
          value={`${totalFinishedPackets.toFixed(0)} Units`}
          sublabel={`${pendingOrdersCount} pending order(s) in pipeline`}
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
        <StatCard
          label="Total Receivables"
          value={formatINR(totalReceivables)}
          sublabel={`${topDebtors.length} customer(s) with open dues`}
          tone={totalReceivables.gt(0) ? "warning" : "success"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Finished & Raw Stock Health */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Inventory Watchlist & Low-Stock Alerts
            </h2>
            <Link
              href="/auditor/stock-ledger"
              className="text-xs font-medium text-[#047857] hover:underline"
            >
              Stock Ledger →
            </Link>
          </div>
          <div className="mt-3 divide-y divide-[#F1F5F9] text-sm">
            {items.slice(0, 8).map((i) => {
              const bal = stockMap.get(i.id) ?? qty(0);
              const re = qty(i.reorderLevel.toString());
              const isLow = re.gt(0) && bal.lte(re);
              return (
                <div key={i.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium text-[#0F172A]">{i.name}</span>{" "}
                    <span className="font-mono text-xs text-[#64748B]">({i.code})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-semibold">
                      {bal.toFixed(2)} {i.unit}
                    </span>
                    {isLow ? (
                      <StatusBadge status="ON_HOLD" customLabel="Low" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {expiringBatches.length > 0 ? (
            <p className="mt-3 text-xs font-medium text-[#B91C1C]">
              Expiring within 15 days:{" "}
              {expiringBatches
                .map((b) => `${b.batchNumber} (${b.item.name})`)
                .join(", ")}
            </p>
          ) : null}
        </div>

        {/* Debtors & Recent Production Economics */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Outstanding Customer Dues
              </h2>
              <Link
                href="/auditor/receivables"
                className="text-xs font-medium text-[#047857] hover:underline"
              >
                Ageing Report →
              </Link>
            </div>
            {topDebtors.length === 0 ? (
              <p className="mt-3 text-xs text-[#64748B]">
                No outstanding customer balances.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-[#F1F5F9] text-sm">
                {topDebtors.slice(0, 5).map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2">
                    <span>
                      {d.name}{" "}
                      <span className="text-xs text-[#64748B]">({d.state})</span>
                    </span>
                    <span className="tabular-nums font-semibold text-[#B45309]">
                      {formatINR(d.due)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Recent Batch Costing & Variances
              </h2>
              <Link
                href="/auditor/production-report"
                className="text-xs font-medium text-[#047857] hover:underline"
              >
                Full Report →
              </Link>
            </div>
            {recentRuns.length === 0 ? (
              <p className="mt-3 text-xs text-[#64748B]">
                No completed production runs yet.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-[#F1F5F9] text-sm">
                {recentRuns.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="font-mono text-xs font-semibold">
                        {r.runNumber}
                      </span>{" "}
                      — {r.bom.finishedItem.name}
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-xs text-[#475569]">
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
          </div>
        </div>
      </div>

      {lowStockItems.length > 0 ? (
        <InlineAlert variant="warning" title="Reorder Attention Required">
          {lowStockItems.map((i) => i.name).join(", ")} have reached or dropped below reorder levels.
        </InlineAlert>
      ) : null}
    </div>
  );
}
