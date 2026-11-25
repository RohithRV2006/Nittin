import type { Metadata } from "next";
import { InvoiceStatus } from "@prisma/client";
import {
  ReceivablesClient,
  type ReceivablesPageData,
} from "@/components/auditor/ReceivablesClient";
import { money } from "@/lib/decimal";
import { parseDateRangeParams } from "@/lib/engines/reports";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Receivables & Ageing",
  description: "Customer payment register and ageing buckets.",
};

export const dynamic = "force-dynamic";

export default async function AuditorReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; fy?: string }>;
}) {
  const filter = parseDateRangeParams(await searchParams);
  const asOfMs = filter.toDate.getTime();

  const [customers, payments] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      include: {
        invoices: { where: { status: InvoiceStatus.POSTED } },
      },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: filter.fromDate, lte: filter.toDate } },
      orderBy: { paymentDate: "desc" },
      include: {
        customer: { select: { name: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    }),
  ]);

  const debtors: ReceivablesPageData["debtors"] = customers.map((c) => {
    let totalInvoiced = money(0);
    let totalPaid = money(0);
    let b1 = money(0);
    let b2 = money(0);
    let b3 = money(0);
    let b4 = money(0);

    for (const inv of c.invoices) {
      const invTot = money(inv.totalAmount.toString());
      const invPaid = money(inv.paidAmount.toString());
      const due = money(invTot.minus(invPaid));

      totalInvoiced = money(totalInvoiced.plus(invTot));
      totalPaid = money(totalPaid.plus(invPaid));

      if (due.gt(0)) {
        const ageDays = Math.max(
          0,
          Math.floor((asOfMs - inv.invoiceDate.getTime()) / (24 * 60 * 60 * 1000))
        );
        if (ageDays <= 30) b1 = money(b1.plus(due));
        else if (ageDays <= 60) b2 = money(b2.plus(due));
        else if (ageDays <= 90) b3 = money(b3.plus(due));
        else b4 = money(b4.plus(due));
      }
    }

    return {
      customerId: c.id,
      customerName: c.name,
      state: c.state,
      totalInvoiced: totalInvoiced.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      outstanding: money(totalInvoiced.minus(totalPaid)).toFixed(2),
      bucket0_30: b1.toFixed(2),
      bucket31_60: b2.toFixed(2),
      bucket61_90: b3.toFixed(2),
      bucket90Plus: b4.toFixed(2),
    };
  });

  const data: ReceivablesPageData = {
    from: filter.from,
    to: filter.to,
    debtors,
    payments: payments.map((p) => ({
      id: p.id,
      date: p.paymentDate.toISOString().slice(0, 10),
      customerName: p.customer.name,
      invoiceNumber: p.invoice?.invoiceNumber ?? null,
      mode: p.paymentMode,
      referenceNumber: p.referenceNumber,
      amount: p.amount.toFixed(2),
    })),
  };

  return <ReceivablesClient data={data} />;
}
