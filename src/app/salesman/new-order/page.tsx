import { ItemCategory, Role } from "@prisma/client";
import {
  NewOrderWorkspace,
  type NewOrderCatalogData,
} from "@/components/salesman/NewOrderWorkspace";
import { requireVerifiedUser } from "@/lib/auth";
import { qty } from "@/lib/decimal";
import { getItemStockMap } from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SalesmanNewOrderPage() {
  const user = await requireVerifiedUser([Role.SALESMAN]);

  const [settings, customers, products, stockMap] = await Promise.all([
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
  ]);

  const initialData: NewOrderCatalogData = {
    factoryStateCode: settings?.stateCode ?? "",
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      state: c.state,
      stateCode: c.stateCode,
      gstin: c.gstin,
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
