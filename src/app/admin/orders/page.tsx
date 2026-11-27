import type { Metadata } from "next";
import { InvoiceStatus, PaymentStatus } from "@prisma/client";
import { money, qty } from "@/lib/decimal";
import { getItemStockMap } from "@/lib/engines/stock";
import { getCachedCompanySettings, prisma, withDbRetry } from "@/lib/prisma";
import {
  OrdersWorkspace,
  type OrdersPageData,
} from "@/components/admin/OrdersWorkspace";

export const metadata: Metadata = {
  title: "Incoming Orders",
  description: "Verify stock sufficiency and convert orders to GST invoices.",
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [settings, orders, stockMap, postedInvoices] = await withDbRetry(() =>
    Promise.all([
      getCachedCompanySettings(),
      prisma.order.findMany({
        orderBy: { orderDate: "desc" },
        take: 250,
      include: {
        salesman: { select: { name: true } },
        customer: {
          select: {
            id: true,
            name: true,
            state: true,
            stateCode: true,
            gstin: true,
            creditLimit: true,
          },
        },
        invoice: { select: { invoiceNumber: true } },
        items: {
          include: {
            item: {
              select: { id: true, name: true, code: true, unit: true, taxRate: true },
            },
          },
        },
      },
    }),
    getItemStockMap(prisma),
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
    ])
  );

  const dueByCustomer = new Map<string, ReturnType<typeof money>>();
  for (const inv of postedInvoices) {
    let cnSum = money(0);
    for (const cn of inv.creditNotes) cnSum = money(cnSum.plus(cn.amount.toString()));
    const due = money(inv.totalAmount.toString())
      .minus(cnSum)
      .minus(inv.paidAmount.toString());
    if (due.gt(0)) {
      dueByCustomer.set(
        inv.customerId,
        money((dueByCustomer.get(inv.customerId) ?? money(0)).plus(due))
      );
    }
  }

  const data: OrdersPageData = {
    factoryConfigured: Boolean(settings?.isConfigured && settings.stateCode),
    factoryStateCode: settings?.stateCode ?? "",
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      orderDate: o.orderDate.toISOString().slice(0, 10),
      salesmanName: o.salesman.name,
      customerName: o.customer.name,
      customerState: o.customer.state,
      customerStateCode: o.customer.stateCode,
      customerGstin: o.customer.gstin,
      customerCreditLimit: o.customer.creditLimit.toFixed(2),
      customerCurrentDue: (dueByCustomer.get(o.customer.id) ?? money(0)).toFixed(2),
      status: o.status,
      totalAmount: o.totalAmount.toFixed(2),
      notes: o.notes,
      invoiceNumber: o.invoice?.invoiceNumber ?? null,
      items: o.items.map((li) => ({
        orderItemId: li.id,
        itemId: li.itemId,
        itemName: li.item.name,
        itemCode: li.item.code,
        unit: li.item.unit,
        taxRate: li.item.taxRate.toFixed(2),
        quantity: li.quantity.toFixed(3),
        unitPrice: li.unitPrice.toFixed(2),
        availableStock: (stockMap.get(li.itemId) ?? qty(0)).toFixed(3),
      })),
    })),
  };

  return <OrdersWorkspace data={data} />;
}
