"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { ResetRequestStatus, Role } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { money, percent, qty } from "@/lib/decimal";
import { writeAuditLog } from "@/lib/engines/audit";
import { prisma } from "@/lib/prisma";
import {
  adminResetPasswordSchema,
  companySettingsSchema,
  createUserSchema,
  customerPriceSchema,
  customerSchema,
  itemSchema,
  supplierSchema,
} from "@/lib/validators/phase1";

export interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function updateCompanySettingsAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = companySettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const v = parsed.data;
    await prisma.$transaction(async (tx) => {
      const prev = await tx.companySettings.findUnique({ where: { id: "default" } });
      const updated = await tx.companySettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          companyName: v.companyName,
          gstin: v.gstin,
          state: v.state,
          stateCode: v.stateCode,
          address: v.address,
          phone: v.phone || null,
          bankDetails: v.bankDetails || null,
          defaultTolerancePercent: percent(v.defaultTolerancePercent),
          isConfigured: true,
        },
        update: {
          companyName: v.companyName,
          gstin: v.gstin,
          state: v.state,
          stateCode: v.stateCode,
          address: v.address,
          phone: v.phone || null,
          bankDetails: v.bankDetails || null,
          defaultTolerancePercent: percent(v.defaultTolerancePercent),
          isConfigured: true,
        },
      });

      await writeAuditLog(tx, {
        entityType: "COMPANY_SETTINGS",
        entityId: updated.id,
        action: "UPDATE",
        userId: actor.id,
        changes: { before: prev, after: updated },
      });
    });

    revalidatePath("/admin/masters");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save settings" };
  }
}

export async function upsertItemAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = itemSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item" };
    }

    const v = parsed.data;
    await prisma.$transaction(async (tx) => {
      const payload = {
        code: v.code,
        name: v.name,
        category: v.category,
        unit: v.unit,
        packWeightGrams:
          v.packWeightGrams != null ? qty(v.packWeightGrams) : null,
        unitsPerCarton: v.unitsPerCarton ?? null,
        hsnCode: v.hsnCode,
        taxRate: percent(v.taxRate),
        sellingPrice: v.sellingPrice != null ? money(v.sellingPrice) : null,
        reorderLevel: qty(v.reorderLevel),
      };

      if (v.id) {
        const before = await tx.item.findUnique({ where: { id: v.id } });
        const after = await tx.item.update({ where: { id: v.id }, data: payload });
        await writeAuditLog(tx, {
          entityType: "ITEM",
          entityId: after.id,
          action: "UPDATE",
          userId: actor.id,
          changes: { before, after },
        });
      } else {
        const created = await tx.item.create({ data: payload });
        await writeAuditLog(tx, {
          entityType: "ITEM",
          entityId: created.id,
          action: "CREATE",
          userId: actor.id,
          changes: { after: created },
        });
      }
    });

    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save item" };
  }
}

export async function toggleItemActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({ where: { id }, data: { active } });
      await writeAuditLog(tx, {
        entityType: "ITEM",
        entityId: updated.id,
        action: "UPDATE",
        userId: actor.id,
        changes: { active },
        reason: active ? "Reactivated item" : "Deactivated item",
      });
    });
    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

export async function upsertCustomerAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid customer" };
    }

    const v = parsed.data;
    await prisma.$transaction(async (tx) => {
      const payload = {
        name: v.name,
        type: v.type,
        gstin: v.gstin || null,
        state: v.state,
        stateCode: v.stateCode,
        phone: v.phone,
        address: v.address,
        creditLimit: money(v.creditLimit),
        creditDays: v.creditDays,
        assignedSalesmanId: v.assignedSalesmanId || null,
      };

      if (v.id) {
        const before = await tx.customer.findUnique({ where: { id: v.id } });
        const after = await tx.customer.update({ where: { id: v.id }, data: payload });
        await writeAuditLog(tx, {
          entityType: "CUSTOMER",
          entityId: after.id,
          action: "UPDATE",
          userId: actor.id,
          changes: { before, after },
        });
      } else {
        const created = await tx.customer.create({ data: payload });
        await writeAuditLog(tx, {
          entityType: "CUSTOMER",
          entityId: created.id,
          action: "CREATE",
          userId: actor.id,
          changes: { after: created },
        });
      }
    });

    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save customer" };
  }
}

export async function toggleCustomerActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data: { active } });
      await writeAuditLog(tx, {
        entityType: "CUSTOMER",
        entityId: id,
        action: "UPDATE",
        userId: actor.id,
        changes: { active },
      });
    });
    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

export async function upsertCustomerPriceAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = customerPriceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rate" };
    }
    const v = parsed.data;
    await prisma.$transaction(async (tx) => {
      const record = await tx.customerPrice.upsert({
        where: {
          customerId_itemId: { customerId: v.customerId, itemId: v.itemId },
        },
        create: {
          customerId: v.customerId,
          itemId: v.itemId,
          customPrice: money(v.customPrice),
          active: true,
        },
        update: {
          customPrice: money(v.customPrice),
          active: true,
        },
      });
      await writeAuditLog(tx, {
        entityType: "CUSTOMER_PRICE",
        entityId: record.id,
        action: "UPDATE",
        userId: actor.id,
        changes: { customPrice: v.customPrice },
      });
    });
    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save price" };
  }
}

export async function upsertSupplierAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = supplierSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid supplier" };
    }

    const v = parsed.data;
    await prisma.$transaction(async (tx) => {
      const payload = {
        name: v.name,
        gstin: v.gstin || null,
        state: v.state,
        stateCode: v.stateCode,
        phone: v.phone || null,
        address: v.address || null,
      };
      if (v.id) {
        const before = await tx.supplier.findUnique({ where: { id: v.id } });
        const after = await tx.supplier.update({ where: { id: v.id }, data: payload });
        await writeAuditLog(tx, {
          entityType: "SUPPLIER",
          entityId: after.id,
          action: "UPDATE",
          userId: actor.id,
          changes: { before, after },
        });
      } else {
        const created = await tx.supplier.create({ data: payload });
        await writeAuditLog(tx, {
          entityType: "SUPPLIER",
          entityId: created.id,
          action: "CREATE",
          userId: actor.id,
          changes: { after: created },
        });
      }
    });

    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save supplier" };
  }
}

export async function toggleSupplierActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id }, data: { active } });
      await writeAuditLog(tx, {
        entityType: "SUPPLIER",
        entityId: id,
        action: "UPDATE",
        userId: actor.id,
        changes: { active },
      });
    });
    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

export async function createUserAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid user" };
    }

    const v = parsed.data;
    const hashedPassword = await bcrypt.hash(v.password, 12);

    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: v.name,
          email: v.email,
          password: hashedPassword,
          role: v.role,
          phone: v.phone || null,
          active: true,
        },
        select: { id: true, email: true, name: true, role: true },
      });
      await writeAuditLog(tx, {
        entityType: "USER",
        entityId: created.id,
        action: "CREATE",
        userId: actor.id,
        changes: { after: created },
      });
    });

    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create user" };
  }
}

export async function toggleUserActiveAction(
  userId: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    if (actor.id === userId && !active) {
      return { ok: false, error: "You cannot deactivate your own active admin account." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          active,
          // Increment tokenVersion so existing JWTs are invalidated immediately
          tokenVersion: { increment: 1 },
        },
      });
      await writeAuditLog(tx, {
        entityType: "USER",
        entityId: userId,
        action: "UPDATE",
        userId: actor.id,
        changes: { active, sessionRevoked: true },
        reason: active ? "User reactivated" : "User deactivated & sessions revoked",
      });
    });

    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update user" };
  }
}

export async function unlockUserAction(userId: string): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      await writeAuditLog(tx, {
        entityType: "USER",
        entityId: userId,
        action: "UPDATE",
        userId: actor.id,
        reason: "Admin unlocked account after lockout",
      });
    });
    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unlock failed" };
  }
}

export async function adminResetUserPasswordAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = adminResetPasswordSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid temporary password",
      };
    }

    const { userId, temporaryPassword } = parsed.data;
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.passwordResetRequest.updateMany({
        where: { userId, status: ResetRequestStatus.PENDING },
        data: {
          status: ResetRequestStatus.COMPLETED,
          resolvedById: actor.id,
          resolvedAt: new Date(),
        },
      });
      await writeAuditLog(tx, {
        entityType: "USER",
        entityId: userId,
        action: "PASSWORD_RESET",
        userId: actor.id,
        changes: { mustChangePassword: true, sessionRevoked: true },
        reason: "Admin issued temporary password reset",
      });
    });

    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reset password",
    };
  }
}
