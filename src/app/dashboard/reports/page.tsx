import type { Metadata } from "next";
import { InvoiceStatus, ItemCategory, ProductionRunStatus } from "@prisma/client";
import {
  OwnerAnalyticsClient,
  type AnalyticsPeriodPoint,
  type OwnerAnalyticsData,
} from "@/components/owner/OwnerAnalyticsClient";
import { prisma, withDbRetry } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Business Analytics & Reports",
  description: "Monthly and yearly sales, procurement, production, and stock valuation reports.",
};

export const dynamic = "force-dynamic";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function OwnerReportsPage() {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [invoices, purchases, payments, runs, batches, invoiceItems] =
    await withDbRetry(() => Promise.all([
      prisma.invoice.findMany({
        where: { status: InvoiceStatus.POSTED },
        select: {
          invoiceDate: true,
          totalAmount: true,
          customer: { select: { name: true, state: true } },
        },
      }),
      prisma.purchase.findMany({
        select: { purchaseDate: true, totalAmount: true },
      }),
      prisma.payment.findMany({
        select: { paymentDate: true, amount: true },
      }),
      prisma.productionRun.findMany({
        where: { status: ProductionRunStatus.COMPLETED },
        select: { runDate: true, actualOutput: true },
      }),
      prisma.stockBatch.findMany({
        where: { remainingQty: { gt: 0 } },
        select: {
          remainingQty: true,
          unitRate: true,
          item: { select: { category: true } },
        },
      }),
      prisma.invoiceItem.findMany({
        where: { invoice: { status: InvoiceStatus.POSTED } },
        select: {
          quantity: true,
          totalAmount: true,
          item: { select: { name: true, unit: true } },
        },
      }),
    ]));

  // Build 12-month timeline
  const monthlyMap = new Map<string, AnalyticsPeriodPoint>();
  for (let offset = 11; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = monthKey(d);
    monthlyMap.set(key, {
      key,
      label: `${MONTH_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
      sales: 0,
      purchases: 0,
      collections: 0,
      unitsProduced: 0,
    });
  }

  const yearlyMap = new Map<string, AnalyticsPeriodPoint>();
  const getOrCreateYear = (d: Date) => {
    const yr = String(d.getFullYear());
    let entry = yearlyMap.get(yr);
    if (!entry) {
      entry = {
        key: yr,
        label: `CY ${yr}`,
        sales: 0,
        purchases: 0,
        collections: 0,
        unitsProduced: 0,
      };
      yearlyMap.set(yr, entry);
    }
    return entry;
  };

  const customerTotals = new Map<
    string,
    { name: string; state: string; revenue: number }
  >();
  let totalSalesAll = 0;

  for (const inv of invoices) {
    const amt = Number(inv.totalAmount.toString());
    totalSalesAll += amt;
    if (inv.invoiceDate >= twelveMonthsAgo) {
      const m = monthlyMap.get(monthKey(inv.invoiceDate));
      if (m) m.sales += amt;
    }
    getOrCreateYear(inv.invoiceDate).sales += amt;

    const existing = customerTotals.get(inv.customer.name) ?? {
      name: inv.customer.name,
      state: inv.customer.state,
      revenue: 0,
    };
    existing.revenue += amt;
    customerTotals.set(inv.customer.name, existing);
  }

  for (const pur of purchases) {
    const amt = Number(pur.totalAmount.toString());
    if (pur.purchaseDate >= twelveMonthsAgo) {
      const m = monthlyMap.get(monthKey(pur.purchaseDate));
      if (m) m.purchases += amt;
    }
    getOrCreateYear(pur.purchaseDate).purchases += amt;
  }

  for (const pay of payments) {
    const amt = Number(pay.amount.toString());
    if (pay.paymentDate >= twelveMonthsAgo) {
      const m = monthlyMap.get(monthKey(pay.paymentDate));
      if (m) m.collections += amt;
    }
    getOrCreateYear(pay.paymentDate).collections += amt;
  }

  for (const run of runs) {
    const out = Number(run.actualOutput.toString());
    if (run.runDate >= twelveMonthsAgo) {
      const m = monthlyMap.get(monthKey(run.runDate));
      if (m) m.unitsProduced += out;
    }
    getOrCreateYear(run.runDate).unitsProduced += out;
  }

  // Ensure current year exists even if empty
  getOrCreateYear(now);

  const productTotals = new Map<
    string,
    { name: string; unit: string; qty: number; revenue: number }
  >();
  for (const line of invoiceItems) {
    const rev = Number(line.totalAmount.toString());
    const q = Number(line.quantity.toString());
    const prev = productTotals.get(line.item.name) ?? {
      name: line.item.name,
      unit: line.item.unit,
      qty: 0,
      revenue: 0,
    };
    prev.qty += q;
    prev.revenue += rev;
    productTotals.set(line.item.name, prev);
  }

  const categoryTotals: Record<ItemCategory, number> = {
    RAW_MATERIAL: 0,
    PACKAGING: 0,
    FINISHED_GOOD: 0,
  };
  let totalStockValuation = 0;
  for (const b of batches) {
    const val = Number(b.remainingQty.toString()) * Number(b.unitRate.toString());
    categoryTotals[b.item.category] += val;
    totalStockValuation += val;
  }

  const data: OwnerAnalyticsData = {
    monthly: Array.from(monthlyMap.values()),
    yearly: Array.from(yearlyMap.values()).sort((a, b) => a.key.localeCompare(b.key)),
    topProducts: Array.from(productTotals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({
        name: p.name,
        qtyLabel: `${p.qty.toFixed(0)} ${p.unit}`,
        revenue: p.revenue,
        sharePct: totalSalesAll > 0 ? (p.revenue / totalSalesAll) * 100 : 0,
      })),
    topCustomers: Array.from(customerTotals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((c) => ({
        name: c.name,
        state: c.state,
        revenue: c.revenue,
        sharePct: totalSalesAll > 0 ? (c.revenue / totalSalesAll) * 100 : 0,
      })),
    stockBreakdown: [
      {
        category: "Raw Materials",
        valuation: categoryTotals.RAW_MATERIAL,
        sharePct:
          totalStockValuation > 0
            ? (categoryTotals.RAW_MATERIAL / totalStockValuation) * 100
            : 0,
      },
      {
        category: "Packaging Materials",
        valuation: categoryTotals.PACKAGING,
        sharePct:
          totalStockValuation > 0
            ? (categoryTotals.PACKAGING / totalStockValuation) * 100
            : 0,
      },
      {
        category: "Finished Goods",
        valuation: categoryTotals.FINISHED_GOOD,
        sharePct:
          totalStockValuation > 0
            ? (categoryTotals.FINISHED_GOOD / totalStockValuation) * 100
            : 0,
      },
    ],
    totalStockValuation,
  };

  return <OwnerAnalyticsClient data={data} />;
}
