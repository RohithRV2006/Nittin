import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./jwt";

export type { SessionPayload };

export interface VerifiedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tokenVersion: number;
  mustChangePassword: boolean;
}

export function isDemoModeEnabled(): boolean {
  return process.env.ENABLE_DEMO_MODE === "true";
}

export async function getCookieSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(raw);
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Full two-layer server verification: validates JWT signature AND checks PostgreSQL
 * `User.active` + `tokenVersion` so deactivated/locked users are blocked immediately.
 */
export async function requireVerifiedUser(
  allowedRoles?: Role[]
): Promise<VerifiedUser> {
  const session = await getCookieSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      tokenVersion: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.active || user.tokenVersion !== session.tokenVersion) {
    throw new Error("UNAUTHORIZED");
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
    mustChangePassword: user.mustChangePassword,
  };
}
