"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { ResetRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  isDemoModeEnabled,
  requireVerifiedUser,
  setSessionCookie,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/engines/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { ROLE_HOME_ROUTES, type UserRole } from "@/lib/roles";
import { changeOwnPasswordSchema } from "@/lib/validators/phase1";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthActionState {
  error?: string;
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const email = parsed.data.email.toLowerCase();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = checkRateLimit(`login:${ip}:${email}`, 12, 5 * 60 * 1000);
  if (!rl.allowed) {
    return {
      error: `Too many sign-in attempts. Please wait ${rl.retryAfterSeconds}s and retry.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return { error: "Invalid email or password." };
  }

  if (!user.active) {
    return { error: "Account is deactivated. Contact Factory Admin." };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return {
      error: `Account temporarily locked due to failed attempts. Try again in ${mins} minute(s).`,
    };
  }

  const valid = await bcrypt.compare(parsed.data.password, user.password);
  if (!valid) {
    const nextAttempts = user.failedLoginAttempts + 1;
    const lockUntil =
      nextAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lockUntil ? 0 : nextAttempts,
        lockedUntil: lockUntil,
      },
    });

    if (lockUntil) {
      return {
        error: `Too many failed login attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
      };
    }
    return { error: "Invalid email or password." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const role = user.role as UserRole;
  await setSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
    tokenVersion: user.tokenVersion,
  });

  redirect(ROLE_HOME_ROUTES[role] ?? "/");
}

export async function demoSwitchAction(email: string): Promise<AuthActionState> {
  if (!isDemoModeEnabled()) {
    return { error: "Demo mode is disabled in this environment." };
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.active) {
    return { error: "Demo user not found. Seed the benchmark dataset first." };
  }

  const role = user.role as UserRole;
  await setSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
    tokenVersion: user.tokenVersion,
  });

  redirect(ROLE_HOME_ROUTES[role] ?? "/");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function requestPasswordResetAction(
  emailInput: string
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const emailParsed = z.string().trim().email("Enter a valid email address").safeParse(emailInput);
  if (!emailParsed.success) {
    return { ok: false, error: emailParsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const email = emailParsed.data.toLowerCase();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = checkRateLimit(`reset-req:${ip}:${email}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return {
      ok: false,
      error: `Too many reset requests. Please retry in ${rl.retryAfterSeconds}s.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, active: true },
  });

  if (user && user.active) {
    const existingPending = await prisma.passwordResetRequest.findFirst({
      where: { userId: user.id, status: ResetRequestStatus.PENDING },
      select: { id: true },
    });
    if (!existingPending) {
      await prisma.$transaction(async (tx) => {
        const req = await tx.passwordResetRequest.create({
          data: { userId: user.id, status: ResetRequestStatus.PENDING },
        });
        await writeAuditLog(tx, {
          entityType: "PASSWORD_RESET",
          entityId: req.id,
          action: "REQUEST",
          userId: user.id,
          reason: "User requested password reset from login screen",
        });
      });
    }
  }

  // Always return generic non-enumerating confirmation
  return {
    ok: true,
    message:
      "If an active account matches that email, a password reset request has been sent to your Factory Admin.",
  };
}

export async function changeOwnPasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireVerifiedUser();
    const parsed = changeOwnPasswordSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid password input",
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, email: true, name: true, role: true, password: true },
    });
    if (!user) return { ok: false, error: "Account not found." };

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!valid) {
      return { ok: false, error: "Current password is incorrect." };
    }

    const sameAsOld = await bcrypt.compare(parsed.data.newPassword, user.password);
    if (sameAsOld) {
      return {
        ok: false,
        error: "New password must be different from your current password.",
      };
    }

    const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);
    const updated = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
        },
        select: { tokenVersion: true },
      });
      await tx.passwordResetRequest.updateMany({
        where: { userId: user.id, status: ResetRequestStatus.PENDING },
        data: {
          status: ResetRequestStatus.COMPLETED,
          resolvedById: user.id,
          resolvedAt: new Date(),
        },
      });
      await writeAuditLog(tx, {
        entityType: "USER",
        entityId: user.id,
        action: "PASSWORD_CHANGE",
        userId: user.id,
        reason: "User updated own password & rotated session version",
      });
      return nextUser;
    });

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      tokenVersion: updated.tokenVersion,
    });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update password",
    };
  }
}
