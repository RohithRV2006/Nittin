import { PrismaClient } from "@prisma/client";
import { isDatabaseUnavailableError } from "./errors";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Retries transient PostgreSQL/Neon idle-socket disconnects before failing.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  retries = 2
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (!isDatabaseUnavailableError(err) || attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}
