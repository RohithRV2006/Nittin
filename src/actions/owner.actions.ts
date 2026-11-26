"use server";
import { toSafeErrorMessage } from "@/lib/errors";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { ResetRequestStatus, Role } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { percent } from "@/lib/decimal";
import { writeAuditLog } from "@/lib/engines/audit";
import { prisma } from "@/lib/prisma";
import {
  adminResetPasswordSchema,
  companySettingsSchema,
  createUserSchema,
} from "@/lib/validators/phase1";
import type { ActionResult } from "./masters.actions";

const OWNER_MANAGED_ROLES: Role[] = [Role.FACTORY_ADMIN, Role.AUDITOR];

export async function ownerCreateTeamUserAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.OWNER]);
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid user" };
    }

    const v = parsed.data;
    if (!OWNER_MANAGED_ROLES.includes(v.role)) {
      return {
        ok: false,
        error: "Owner creates Factory Admins and Auditors here; Factory Admins manage field and floor staff.",
      };
    }

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
        changes: { after: created, createdByRole: "OWNER" },
      });
    });

    revalidatePath("/dashboard/team");
    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to create team account"),
    };
  }
}

export async function ownerToggleUserActiveAction(
  userId: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.OWNER]);
    if (actor.id === userId && !active) {
      return { ok: false, error: "You cannot deactivate your own Owner account." };
    }

    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!target) throw new Error("User not found.");
      if (target.role === Role.OWNER) {
        throw new Error("Owner accounts cannot be deactivated from this console.");
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          active,
          tokenVersion: { increment: 1 },
        },
      });
      await writeAuditLog(tx, {
        entityType: "USER",
        entityId: userId,
        action: "UPDATE",
        userId: actor.id,
        changes: { active, sessionRevoked: true },
        reason: active ? "Owner reactivated account" : "Owner deactivated account & revoked sessions",
      });
    });

    revalidatePath("/dashboard/team");
    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to update account status"),
    };
  }
}

export async function ownerUnlockUserAction(userId: string): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.OWNER]);
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
        reason: "Owner unlocked account after lockout",
      });
    });

    revalidatePath("/dashboard/team");
    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to unlock account"),
    };
  }
}

export async function ownerResetUserPasswordAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.OWNER]);
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
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!target) throw new Error("User not found.");
      if (target.role === Role.OWNER && userId !== actor.id) {
        throw new Error("Cannot reset another Owner account password.");
      }

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
        changes: { mustChangePassword: true, sessionRevoked: true, byRole: "OWNER" },
        reason: "Owner issued temporary password reset",
      });
    });

    revalidatePath("/dashboard/team");
    revalidatePath("/admin/masters");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to reset password"),
    };
  }
}

export async function ownerUpdateCompanySettingsAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.OWNER]);
    const parsed = companySettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const v = parsed.data;
    await prisma.$transaction(async (tx) => {
      const before = await tx.companySettings.findUnique({ where: { id: "default" } });
      const after = await tx.companySettings.upsert({
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
        entityId: "default",
        action: before ? "UPDATE" : "CREATE",
        userId: actor.id,
        changes: { before, after },
      });
    });

    revalidatePath("/dashboard/team");
    revalidatePath("/dashboard");
    revalidatePath("/admin/masters");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to save company settings"),
    };
  }
}
