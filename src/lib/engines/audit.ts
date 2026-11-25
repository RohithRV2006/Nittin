import { Prisma } from "@prisma/client";

export interface AuditEntryInput {
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  changes?: Prisma.InputJsonValue;
  reason?: string | null;
}

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  entry: AuditEntryInput
) {
  return tx.auditLog.create({
    data: {
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId,
      changes: entry.changes,
      reason: entry.reason ?? null,
    },
  });
}
