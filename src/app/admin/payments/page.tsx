import { InvoiceStatus, PaymentStatus } from "@prisma/client";
import {
  PaymentsWorkspace,
  type PaymentsPageData,
} from "@/components/admin/PaymentsWorkspace";
import { money } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const [settings, customers, payments] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.customer.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        invoices: {
          where: { status: InvoiceStatus.POSTED },
          orderBy: { invoiceDate: "asc" },
        },
      },
    }),
    prisma.payment.findMany({
      orderBy: { paymentDate: "desc" },
      take: 50,
      include: {
        customer: { select: { name: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    }),
  ]);

  const data: PaymentsPageData = {
    companyName: settings?.companyName ?? "Factory",
    companyGstin: settings?.gstin ?? "",
    customers: customers.map((c) => {
      let totalInvoiced = money(0);
      let totalPaid = money(0);
      const openInvoices: PaymentsPageData["customers"][number]["openInvoices"] = [];

      for (const inv of c.invoices) {
        const invTot = money(inv.totalAmount.toString());
        const invPaid = money(inv.paidAmount.toString());
        totalInvoiced = money(totalInvoiced.plus(invTot));
        totalPaid = money(totalPaid.plus(invPaid));

        if (inv.paymentStatus !== PaymentStatus.PAID) {
          openInvoices.push({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
            balanceDue: money(invTot.minus(invPaid)).toFixed(2),
          });
        }
      }

      return {
        id: c.id,
        name: c.name,
        state: c.state,
        totalInvoiced: totalInvoiced.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        outstanding: money(totalInvoiced.minus(totalPaid)).toFixed(2),
        openInvoices,
      };
    }),
    payments: payments.map((p) => ({
      id: p.id,
      customerName: p.customer.name,
      invoiceNumber: p.invoice?.invoiceNumber ?? null,
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
      amount: p.amount.toFixed(2),
      paymentMode: p.paymentMode,
      referenceNumber: p.referenceNumber,
      notes: p.notes,
    })),
  };

  return <PaymentsWorkspace data={data} />;
}
