import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import {
  InvoicesWorkspace,
  type InvoiceRow,
} from "@/components/admin/InvoicesWorkspace";

export const metadata: Metadata = {
  title: "GST Invoicing & Dispatch",
  description: "Download GST invoices, dispatch goods, and export e-Invoices.",
};

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  const [settings, invoices] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.invoice.findMany({
      orderBy: { invoiceDate: "desc" },
      include: {
        order: { select: { orderNumber: true } },
        customer: true,
        creditNotes: { select: { creditNoteNumber: true }, take: 1 },
        items: { include: { item: { select: { name: true, unit: true } } } },
      },
    }),
  ]);

  const seller = {
    companyName: settings?.companyName ?? "",
    gstin: settings?.gstin ?? "",
    address: settings?.address ?? "",
    state: settings?.state ?? "",
    stateCode: settings?.stateCode ?? "",
    phone: settings?.phone ?? null,
    bankDetails: settings?.bankDetails ?? null,
  };

  const rows: InvoiceRow[] = invoices.map((inv) => {
    const meta = inv.eInvoiceMeta as { irn?: string } | null;
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      orderNumber: inv.order.orderNumber,
      invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
      dueDate: inv.dueDate.toISOString().slice(0, 10),
      status: inv.status,
      dispatchStatus: inv.dispatchStatus,
      paymentStatus: inv.paymentStatus,
      placeOfSupply: inv.placeOfSupply,
      placeOfSupplyCode: inv.placeOfSupplyCode,
      seller,
      buyer: {
        name: inv.customer.name,
        gstin: inv.customer.gstin,
        address: inv.customer.address,
        state: inv.customer.state,
        stateCode: inv.customer.stateCode,
        phone: inv.customer.phone,
      },
      items: inv.items.map((li) => ({
        itemName: li.item.name,
        hsnCode: li.hsnCode,
        quantity: li.quantity.toFixed(3),
        unit: li.item.unit,
        unitPrice: li.unitPrice.toFixed(2),
        taxRate: li.taxRate.toFixed(2),
        taxableAmount: li.taxableAmount.toFixed(2),
        cgstAmount: li.cgstAmount.toFixed(2),
        sgstAmount: li.sgstAmount.toFixed(2),
        igstAmount: li.igstAmount.toFixed(2),
        totalAmount: li.totalAmount.toFixed(2),
      })),
      taxableAmount: inv.taxableAmount.toFixed(2),
      cgstAmount: inv.cgstAmount.toFixed(2),
      sgstAmount: inv.sgstAmount.toFixed(2),
      igstAmount: inv.igstAmount.toFixed(2),
      totalAmount: inv.totalAmount.toFixed(2),
      paidAmount: inv.paidAmount.toFixed(2),
      irn: meta?.irn ?? null,
      creditNoteNumber: inv.creditNotes[0]?.creditNoteNumber ?? null,
    };
  });

  return <InvoicesWorkspace invoices={rows} />;
}
