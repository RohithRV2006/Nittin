import type { Metadata } from "next";
import { qty } from "@/lib/decimal";
import { getItemStockMap } from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";
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
  const [settings, orders, stockMap] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.order.findMany({
      orderBy: { orderDate: "desc" },
      include: {
        salesman: { select: { name: true } },
        customer: {
          select: { name: true, state: true, stateCode: true, gstin: true },
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
  ]);

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
