import { Prisma } from "@prisma/client";

const INTERNAL_ERROR_PATTERNS = [
  /prisma/i,
  /invalid `.*` invocation/i,
  /can't reach database/i,
  /database server/i,
  /postgres/i,
  /econnrefused/i,
  /econnreset/i,
  /etimedout/i,
  /enotfound/i,
  /socket/i,
  /connection terminated/i,
  /connection pool/i,
  /unique constraint/i,
  /foreign key constraint/i,
  /violates .* constraint/i,
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /invalid input syntax/i,
  /\n\s+at\s+/,
];

const DB_UNAVAILABLE_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1008",
  "P1011",
  "P1017",
  "P2024",
]);

/**
 * Returns true if the error is a Prisma/PostgreSQL connectivity or pool failure.
 */
export function isDatabaseUnavailableError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return DB_UNAVAILABLE_CODES.has(err.code);
  }
  if (err instanceof Error) {
    const msg = err.message;
    return (
      /can't reach database/i.test(msg) ||
      /database server/i.test(msg) ||
      /econnrefused|econnreset|etimedout|enotfound/i.test(msg) ||
      /connection terminated|connection pool/i.test(msg)
    );
  }
  return false;
}

/**
 * Converts unknown server/database errors into safe, user-friendly messages.
 * Never exposes Prisma queries, SQL details, stack traces, or hostnames.
 */
export function toSafeErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (isDatabaseUnavailableError(err)) {
    return "Service is temporarily unable to reach the database. Please try again in a moment.";
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        return "A record with these details already exists.";
      case "P2003":
        return "This record is linked to existing transactions and cannot be changed.";
      case "P2025":
        return "The requested record was not found or was already removed.";
      default:
        return fallback;
    }
  }

  if (
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return fallback;
  }

  if (err instanceof Error) {
    const msg = err.message?.trim();
    if (!msg) return fallback;
    if (INTERNAL_ERROR_PATTERNS.some((re) => re.test(msg))) {
      return fallback;
    }
    return msg;
  }

  return fallback;
}
