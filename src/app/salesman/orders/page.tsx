import type { Metadata } from "next";
import { OrderStatus, Role } from "@prisma/client";
import {
  SalesmanOrdersWorkspace,
  type SalesmanOrdersPageData,
} from "@/components/salesman/SalesmanOrdersWorkspace";
import { requireVerifiedUser } from "@/lib/auth";
import { money } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "My Orders & Sales",
  description: "Track submitted orders, offline queue, and customer totals.",
};

export const dynamic = "force-dynamic";

export default async function SalesmanOrdersPage() {
  const user = await requireVerifiedUser([Role.SALESMAN]);

  const orders = await prisma.order.findMany({
    where: { salesmanId: user.id },
    orderBy: { orderDate: "desc" },
    include: {
      customer: { select: { id: true, name: true, state: true } },
      items: {
        include: { item: { select: { name: true, unit: true } } },
      },
    },
  });

  const summaryMap = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      state: string;
      orderCount: number;
      totalBooked: ReturnType<typeof money>;
      invoicedOrDispatched: ReturnType<typeof money>;
      lastOrderDate: string;
    }
  >();

  for (const o of orders) {
    if (
      o.status === OrderStatus.CANCELLED ||
      o.status === OrderStatus.REJECTED
    ) {
      continue;
    }

    const existing = summaryMap.get(o.customer.id) ?? {
      customerId: o.customer.id,
      customerName: o.customer.name,
      state: o.customer.state,
      orderCount: 0,
      totalBooked: money(0),
      invoicedOrDispatched: money(0),
      lastOrderDate: o.orderDate.toISOString().slice(0, 10),
    };

    existing.orderCount += 1;
    existing.totalBooked = money(
      existing.totalBooked.plus(o.totalAmount.toString())
    );
    if (
      o.status === OrderStatus.INVOICED ||
      o.status === OrderStatus.DISPATCHED
    ) {
      existing.invoicedOrDispatched = money(
        existing.invoicedOrDispatched.plus(o.totalAmount.toString())
      );
    }

    summaryMap.set(o.customer.id, existing);
  }

  const data: SalesmanOrdersPageData = {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer.name,
      customerState: o.customer.state,
      orderDate: o.orderDate.toISOString().slice(0, 10),
      status: o.status,
      totalAmount: o.totalAmount.toFixed(2),
      notes: o.notes,
      rejectionReason: o.rejectionReason,
      items: o.items.map((li) => ({
        itemName: li.item.name,
        quantity: li.quantity.toFixed(0),
        unit: li.item.unit,
        unitPrice: li.unitPrice.toFixed(2),
        totalAmount: li.totalAmount.toFixed(2),
      })),
    })),
    customerSummary: Array.from(summaryMap.values()).map((s) => ({
      customerId: s.customerId,
      customerName: s.customerName,
      state: s.state,
      orderCount: s.orderCount,
      totalBooked: s.totalBooked.toFixed(2),
      invoicedOrDispatched: s.invoicedOrDispatched.toFixed(2),
      lastOrderDate: s.lastOrderDate,
    })),
  };

  return <SalesmanOrdersWorkspace data={data} />;
}
