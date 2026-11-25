import { Role } from "@prisma/client";
import {
  SalesmanHomeClient,
  type SalesmanHomeData,
} from "@/components/salesman/SalesmanHomeClient";
import { requireVerifiedUser } from "@/lib/auth";
import { money } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SalesmanHomePage() {
  const user = await requireVerifiedUser([Role.SALESMAN]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayOrders, activeCustomersCount, recentOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        salesmanId: user.id,
        orderDate: { gte: startOfDay },
      },
      select: { totalAmount: true },
    }),
    prisma.customer.count({
      where: {
        active: true,
        OR: [{ assignedSalesmanId: user.id }, { assignedSalesmanId: null }],
      },
    }),
    prisma.order.findMany({
      where: { salesmanId: user.id },
      orderBy: { orderDate: "desc" },
      take: 8,
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  let todayValue = money(0);
  for (const o of todayOrders) {
    todayValue = money(todayValue.plus(o.totalAmount.toString()));
  }

  const data: SalesmanHomeData = {
    salesmanName: user.name,
    todayOrderCount: todayOrders.length,
    todayBookedValue: todayValue.toFixed(2),
    activeCustomersCount,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer.name,
      orderDate: o.orderDate.toISOString().slice(0, 10),
      totalAmount: o.totalAmount.toFixed(2),
      status: o.status,
      itemCount: o._count.items,
    })),
  };

  return <SalesmanHomeClient data={data} />;
}
