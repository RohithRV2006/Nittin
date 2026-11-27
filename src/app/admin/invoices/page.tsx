import type { Metadata } from "next";
import { getCachedCompanySettings, prisma, withDbRetry } from "@/lib/prisma";
import {
  InvoicesWorkspace,
  type InvoiceRow,
} from "@/components/admin/InvoicesWorkspace";
import { money, qty } from "@/lib/decimal";

export const metadata: Metadata = {
  title: "GST Invoicing & Dispatch",
  description: "Download GST invoices, partial dispatch, sales returns, and e-Invoices.",
};

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  const [settings, invoices] = await withDbRetry(() =>
    Promise.all([
      getCachedCompanySettings(),
      prisma.invoice.findMany({
        orderBy: { invoiceDate: "desc" },
        take: 200,
      include: {
        order: { select: { orderNumber: true } },
        customer: true,
        creditNotes: {
          orderBy: { issuedAt: "desc" },
          include: {
            items: { include: { item: { select: { name: true, unit: true } } } },
          },
        },
        dispatchChallans: {
          orderBy: { dispatchedAt: "desc" },
          include: {
            items: { include: { item: { select: { name: true, unit: true } } } },
          },
        },
        items: {
          include: {
            item: { select: { name: true, unit: true } },
            creditNoteItems: { select: { returnedQty: true } },
          },
        },
      },
    }),
    ])
  );

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
    let creditTotal = money(0);
    for (const cn of inv.creditNotes) {
      creditTotal = money(creditTotal.plus(cn.amount.toString()));
    }

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
      items: inv.items.map((li) => {
        let returnedQty = qty(0);
        for (const cni of li.creditNoteItems) {
          returnedQty = qty(returnedQty.plus(cni.returnedQty.toString()));
        }
        return {
          invoiceItemId: li.id,
          itemName: li.item.name,
          hsnCode: li.hsnCode,
          quantity: li.quantity.toFixed(3),
          dispatchedQty: li.dispatchedQty.toFixed(3),
          returnedQty: returnedQty.toFixed(3),
          unit: li.item.unit,
          unitPrice: li.unitPrice.toFixed(2),
          taxRate: li.taxRate.toFixed(2),
          taxableAmount: li.taxableAmount.toFixed(2),
          cgstAmount: li.cgstAmount.toFixed(2),
          sgstAmount: li.sgstAmount.toFixed(2),
          igstAmount: li.igstAmount.toFixed(2),
          totalAmount: li.totalAmount.toFixed(2),
        };
      }),
      taxableAmount: inv.taxableAmount.toFixed(2),
      cgstAmount: inv.cgstAmount.toFixed(2),
      sgstAmount: inv.sgstAmount.toFixed(2),
      igstAmount: inv.igstAmount.toFixed(2),
      totalAmount: inv.totalAmount.toFixed(2),
      paidAmount: inv.paidAmount.toFixed(2),
      creditTotal: creditTotal.toFixed(2),
      irn: meta?.irn ?? null,
      creditNoteNumber: inv.creditNotes[0]?.creditNoteNumber ?? null,
      challans: inv.dispatchChallans.map((ch) => ({
        id: ch.id,
        challanNumber: ch.challanNumber,
        dispatchedDate: ch.dispatchedAt.toISOString().slice(0, 10),
        vehicleNumber: ch.vehicleNumber,
        notes: ch.notes,
        items: ch.items.map((ci) => ({
          itemName: ci.item.name,
          quantity: ci.quantity.toFixed(3),
          unit: ci.item.unit,
        })),
      })),
      creditNotes: inv.creditNotes.map((cn) => ({
        id: cn.id,
        creditNoteNumber: cn.creditNoteNumber,
        issuedDate: cn.issuedAt.toISOString().slice(0, 10),
        type: cn.type,
        reason: cn.reason,
        taxableAmount: cn.taxableAmount.toFixed(2),
        cgstAmount: cn.cgstAmount.toFixed(2),
        sgstAmount: cn.sgstAmount.toFixed(2),
        igstAmount: cn.igstAmount.toFixed(2),
        amount: cn.amount.toFixed(2),
        items: cn.items.map((cni) => ({
          itemName: cni.item.name,
          returnedQty: cni.returnedQty.toFixed(3),
          unit: cni.item.unit,
          condition: cni.condition,
          totalAmount: cni.totalAmount.toFixed(2),
        })),
      })),
    };
  });

  return <InvoicesWorkspace invoices={rows} />;
}
