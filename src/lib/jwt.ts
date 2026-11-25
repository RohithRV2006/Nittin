import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "./roles";

export const SESSION_COOKIE_NAME = "nittin_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 hours

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  tokenVersion: number;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be at least 32 characters in production.");
    }
    return new TextEncoder().encode("dev-only-nittin-erp-session-secret-32-bytes!");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    tokenVersion: payload.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.tokenVersion !== "number"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role as UserRole,
      tokenVersion: payload.tokenVersion,
    };
  } catch {
    return null;
  }
}
