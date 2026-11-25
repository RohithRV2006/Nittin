import type { Metadata } from "next";
import { InvoiceStatus, ItemCategory, Role } from "@prisma/client";
import {
  NewOrderWorkspace,
  type NewOrderCatalogData,
} from "@/components/salesman/NewOrderWorkspace";
import { requireVerifiedUser } from "@/lib/auth";
import { money, qty } from "@/lib/decimal";
import { getItemStockMap } from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "New Field Order",
  description: "Create customer orders online or in offline mode.",
};

export const dynamic = "force-dynamic";

export default async function SalesmanNewOrderPage() {
  const user = await requireVerifiedUser([Role.SALESMAN]);

  const [settings, customers, products, stockMap, postedInvoices] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.customer.findMany({
      where: {
        active: true,
        OR: [{ assignedSalesmanId: user.id }, { assignedSalesmanId: null }],
      },
      orderBy: { name: "asc" },
      include: {
        customPrices: {
          where: { active: true },
          select: { itemId: true, customPrice: true },
        },
      },
    }),
    prisma.item.findMany({
      where: {
        active: true,
        category: ItemCategory.FINISHED_GOOD,
        sellingPrice: { not: null },
      },
      orderBy: { name: "asc" },
    }),
    getItemStockMap(prisma),
    prisma.invoice.findMany({
      where: { status: InvoiceStatus.POSTED },
      select: {
        customerId: true,
        totalAmount: true,
        paidAmount: true,
        creditNotes: { select: { amount: true } },
      },
    }),
  ]);

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

  const initialData: NewOrderCatalogData = {
    factoryStateCode: settings?.stateCode ?? "",
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      state: c.state,
      stateCode: c.stateCode,
      gstin: c.gstin,
      creditLimit: c.creditLimit.toFixed(2),
      currentDue: (dueByCustomer.get(c.id) ?? money(0)).toFixed(2),
      customPrices: Object.fromEntries(
        c.customPrices.map((cp) => [cp.itemId, cp.customPrice.toFixed(2)])
      ),
    })),
    products: products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      unitsPerCarton: p.unitsPerCarton,
      taxRate: p.taxRate.toFixed(2),
      sellingPrice: p.sellingPrice?.toFixed(2) ?? "0.00",
      availableStock: (stockMap.get(p.id) ?? qty(0)).toFixed(3),
    })),
  };

  return <NewOrderWorkspace initialData={initialData} />;
}
