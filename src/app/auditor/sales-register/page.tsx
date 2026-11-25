import type { Metadata } from "next";
import { InvoiceStatus } from "@prisma/client";
import {
  SalesRegisterClient,
  type SalesRegisterData,
} from "@/components/auditor/SalesRegisterClient";
import { money, qty } from "@/lib/decimal";
import { parseDateRangeParams } from "@/lib/engines/reports";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Sales Register",
  description: "Invoice, customer, and product outward sales breakdown.",
};

export const dynamic = "force-dynamic";

export default async function AuditorSalesRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; fy?: string }>;
}) {
  const filter = parseDateRangeParams(await searchParams);

  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceDate: { gte: filter.fromDate, lte: filter.toDate },
    },
    orderBy: { invoiceDate: "desc" },
    include: {
      customer: true,
      items: { include: { item: true } },
    },
  });

  const custMap = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      state: string;
      invoiceCount: number;
      taxable: ReturnType<typeof money>;
      tax: ReturnType<typeof money>;
      total: ReturnType<typeof money>;
    }
  >();

  const prodMap = new Map<
    string,
    {
      itemId: string;
      itemCode: string;
      itemName: string;
      hsnCode: string;
      unit: string;
      qtySold: ReturnType<typeof qty>;
      taxable: ReturnType<typeof money>;
      tax: ReturnType<typeof money>;
      total: ReturnType<typeof money>;
    }
  >();

  for (const inv of invoices) {
    if (inv.status !== InvoiceStatus.POSTED) continue;

    const taxSum = money(inv.cgstAmount.toString())
      .plus(inv.sgstAmount.toString())
      .plus(inv.igstAmount.toString());

    const c = custMap.get(inv.customerId) ?? {
      customerId: inv.customerId,
      customerName: inv.customer.name,
      state: inv.customer.state,
      invoiceCount: 0,
      taxable: money(0),
      tax: money(0),
      total: money(0),
    };
    c.invoiceCount += 1;
    c.taxable = money(c.taxable.plus(inv.taxableAmount.toString()));
    c.tax = money(c.tax.plus(taxSum));
    c.total = money(c.total.plus(inv.totalAmount.toString()));
    custMap.set(inv.customerId, c);

    for (const li of inv.items) {
      const liTax = money(li.cgstAmount.toString())
        .plus(li.sgstAmount.toString())
        .plus(li.igstAmount.toString());
      const p = prodMap.get(li.itemId) ?? {
        itemId: li.itemId,
        itemCode: li.item.code,
        itemName: li.item.name,
        hsnCode: li.hsnCode,
        unit: li.item.unit,
        qtySold: qty(0),
        taxable: money(0),
        tax: money(0),
        total: money(0),
      };
      p.qtySold = qty(p.qtySold.plus(li.quantity.toString()));
      p.taxable = money(p.taxable.plus(li.taxableAmount.toString()));
      p.tax = money(p.tax.plus(liTax));
      p.total = money(p.total.plus(li.totalAmount.toString()));
      prodMap.set(li.itemId, p);
    }
  }

  const data: SalesRegisterData = {
    from: filter.from,
    to: filter.to,
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      date: i.invoiceDate.toISOString().slice(0, 10),
      customerName: i.customer.name,
      state: i.placeOfSupply,
      gstin: i.customer.gstin,
      status: i.status,
      taxable: i.taxableAmount.toFixed(2),
      cgst: i.cgstAmount.toFixed(2),
      sgst: i.sgstAmount.toFixed(2),
      igst: i.igstAmount.toFixed(2),
      total: i.totalAmount.toFixed(2),
    })),
    byCustomer: Array.from(custMap.values()).map((c) => ({
      customerId: c.customerId,
      customerName: c.customerName,
      state: c.state,
      invoiceCount: c.invoiceCount,
      taxable: c.taxable.toFixed(2),
      tax: c.tax.toFixed(2),
      total: c.total.toFixed(2),
    })),
    byProduct: Array.from(prodMap.values()).map((p) => ({
      itemId: p.itemId,
      itemCode: p.itemCode,
      itemName: p.itemName,
      hsnCode: p.hsnCode,
      unit: p.unit,
      qtySold: p.qtySold.toFixed(3),
      taxable: p.taxable.toFixed(2),
      tax: p.tax.toFixed(2),
      total: p.total.toFixed(2),
    })),
  };

  return <SalesRegisterClient data={data} />;
}
