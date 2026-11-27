import { cache } from "react";
import { unstable_cache } from "next/cache";
import { Prisma, PrismaClient } from "@prisma/client";
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
 * Extended transaction options for serverless PostgreSQL (Neon) latency.
 */
export const TX_OPTIONS = { maxWait: 10000, timeout: 30000 } as const;

export function runTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(operation, TX_OPTIONS);
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

const fetchCompanySettingsCached = unstable_cache(
  async () => {
    const row = await withDbRetry(() =>
      prisma.companySettings.findUnique({ where: { id: "default" } })
    );
    if (!row) return null;
    return {
      ...row,
      defaultTolerancePercent: row.defaultTolerancePercent.toFixed(2),
    };
  },
  ["company-settings-default"],
  { revalidate: 300, tags: ["company-settings"] }
);

/**
 * Request + Data-Cache deduplicated lookup for `CompanySettings`.
 * Invalidated on settings update or demo reset via `revalidateTag("company-settings")`.
 */
export const getCachedCompanySettings = cache(() => fetchCompanySettingsCached());
