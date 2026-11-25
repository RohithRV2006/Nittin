import type { Metadata } from "next";
import { ResetRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MastersWorkspace, type MastersData } from "@/components/admin/MastersWorkspace";

export const metadata: Metadata = {
  title: "Masters & Settings",
  description: "Manage GST profile, SKUs, customers, suppliers, and users.",
};

export const dynamic = "force-dynamic";

export default async function AdminMastersPage() {
  const [settings, items, customers, suppliers, users] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.item.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      include: {
        assignedSalesman: { select: { name: true } },
        customPrices: {
          where: { active: true },
          include: { item: { select: { name: true } } },
        },
      },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        active: true,
        lockedUntil: true,
        passwordResetRequests: {
          where: { status: ResetRequestStatus.PENDING },
          select: { id: true },
        },
      },
    }),
  ]);

  const data: MastersData = {
    settings: {
      companyName: settings?.companyName ?? "",
      gstin: settings?.gstin ?? "",
      state: settings?.state ?? "",
      stateCode: settings?.stateCode ?? "",
      address: settings?.address ?? "",
      phone: settings?.phone ?? "",
      bankDetails: settings?.bankDetails ?? "",
      defaultTolerancePercent: settings
        ? settings.defaultTolerancePercent.toFixed(2)
        : "3.00",
      isConfigured: settings?.isConfigured ?? false,
    },
    items: items.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      category: i.category,
      unit: i.unit,
      packWeightGrams: i.packWeightGrams?.toFixed(3) ?? null,
      unitsPerCarton: i.unitsPerCarton,
      hsnCode: i.hsnCode,
      taxRate: i.taxRate.toFixed(2),
      sellingPrice: i.sellingPrice?.toFixed(2) ?? null,
      reorderLevel: i.reorderLevel.toFixed(3),
      active: i.active,
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      gstin: c.gstin,
      state: c.state,
      stateCode: c.stateCode,
      phone: c.phone,
      address: c.address,
      creditLimit: c.creditLimit.toFixed(2),
      creditDays: c.creditDays,
      assignedSalesmanId: c.assignedSalesmanId,
      assignedSalesmanName: c.assignedSalesman?.name ?? null,
      active: c.active,
      customPrices: c.customPrices.map((cp) => ({
        itemId: cp.itemId,
        itemName: cp.item.name,
        customPrice: cp.customPrice.toFixed(2),
      })),
    })),
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      gstin: s.gstin,
      state: s.state,
      stateCode: s.stateCode,
      phone: s.phone,
      address: s.address,
      active: s.active,
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      active: u.active,
      lockedUntil: u.lockedUntil?.toISOString() ?? null,
      pendingResetRequest: u.passwordResetRequests.length > 0,
    })),
  };

  return <MastersWorkspace data={data} />;
}
