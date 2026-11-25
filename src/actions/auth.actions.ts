"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  isDemoModeEnabled,
  setSessionCookie,
} from "@/lib/auth";
import { ROLE_HOME_ROUTES, type UserRole } from "@/lib/roles";

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
