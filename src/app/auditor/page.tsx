import { InvoiceStatus, ProductionRunStatus } from "@prisma/client";
import {
  AuditorCenterClient,
  type AuditorCenterData,
} from "@/components/auditor/AuditorCenterClient";
import { money } from "@/lib/decimal";
import { parseDateRangeParams } from "@/lib/engines/reports";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditorCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; fy?: string }>;
}) {
  const filter = parseDateRangeParams(await searchParams);

  const [settings, invoices, purchases, payments, runs, batches] =
    await Promise.all([
      prisma.companySettings.findUnique({ where: { id: "default" } }),
      prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.POSTED,
          invoiceDate: { gte: filter.fromDate, lte: filter.toDate },
        },
        include: { customer: { select: { name: true, gstin: true } } },
        orderBy: { invoiceDate: "asc" },
      }),
      prisma.purchase.findMany({
        where: {
          purchaseDate: { gte: filter.fromDate, lte: filter.toDate },
        },
        include: { supplier: { select: { name: true, gstin: true } } },
        orderBy: { purchaseDate: "asc" },
      }),
      prisma.payment.findMany({
        where: {
          paymentDate: { gte: filter.fromDate, lte: filter.toDate },
        },
        include: {
          customer: { select: { name: true } },
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: { paymentDate: "asc" },
      }),
      prisma.productionRun.findMany({
        where: {
          status: ProductionRunStatus.COMPLETED,
          runDate: { gte: filter.fromDate, lte: filter.toDate },
        },
        select: { varianceFlagged: true },
      }),
      prisma.stockBatch.findMany({
        where: { remainingQty: { gt: 0 } },
        select: { remainingQty: true, unitRate: true },
      }),
    ]);

  let salesTotal = money(0);
  for (const i of invoices) {
    salesTotal = money(salesTotal.plus(i.totalAmount.toString()));
  }
  let purchaseTotal = money(0);
  for (const p of purchases) {
    purchaseTotal = money(purchaseTotal.plus(p.totalAmount.toString()));
  }
  let collectionsTotal = money(0);
  for (const pay of payments) {
    collectionsTotal = money(collectionsTotal.plus(pay.amount.toString()));
  }
  let stockValuation = money(0);
  for (const b of batches) {
    stockValuation = money(
      stockValuation.plus(money(b.remainingQty.toString()).mul(b.unitRate.toString()))
    );
  }

  const data: AuditorCenterData = {
    from: filter.from,
    to: filter.to,
    companyName: settings?.companyName ?? "Factory",
    kpis: {
      salesTotal: salesTotal.toFixed(2),
      purchaseTotal: purchaseTotal.toFixed(2),
      collectionsTotal: collectionsTotal.toFixed(2),
      productionRunsCount: runs.length,
      varianceFlaggedCount: runs.filter((r) => r.varianceFlagged).length,
      stockValuation: stockValuation.toFixed(2),
    },
    tallyInvoices: invoices.map((i) => ({
      invoiceNumber: i.invoiceNumber,
      date: i.invoiceDate.toISOString().slice(0, 10),
      partyName: i.customer.name,
      partyGstin: i.customer.gstin,
      taxableAmount: i.taxableAmount.toFixed(2),
      cgstAmount: i.cgstAmount.toFixed(2),
      sgstAmount: i.sgstAmount.toFixed(2),
      igstAmount: i.igstAmount.toFixed(2),
      totalAmount: i.totalAmount.toFixed(2),
    })),
    tallyPurchases: purchases.map((p) => ({
      purchaseNumber: p.purchaseNumber,
      billNumber: p.billNumber,
      date: p.purchaseDate.toISOString().slice(0, 10),
      supplierName: p.supplier.name,
      supplierGstin: p.supplier.gstin,
      taxableAmount: p.taxableAmount.toFixed(2),
      cgstAmount: p.cgstAmount.toFixed(2),
      sgstAmount: p.sgstAmount.toFixed(2),
      igstAmount: p.igstAmount.toFixed(2),
      totalAmount: p.totalAmount.toFixed(2),
    })),
    tallyReceipts: payments.map((p) => ({
      receiptRef: p.referenceNumber || p.id.slice(0, 8).toUpperCase(),
      date: p.paymentDate.toISOString().slice(0, 10),
      customerName: p.customer.name,
      paymentMode: p.paymentMode,
      amount: p.amount.toFixed(2),
      invoiceNumber: p.invoice?.invoiceNumber ?? null,
    })),
  };

  return <AuditorCenterClient data={data} />;
}
