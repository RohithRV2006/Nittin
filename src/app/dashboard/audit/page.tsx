import type { Metadata } from "next";
import {
  AuditLogClient,
  type AuditLogPageData,
} from "@/components/auditor/AuditLogClient";
import { parseDateRangeParams } from "@/lib/engines/reports";
import { prisma, withDbRetry } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Audit & Activity Trail",
  description: "Company-wide audit log of order edits, dispatches, runs, and adjustments.",
};

export const dynamic = "force-dynamic";

export default async function OwnerAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; fy?: string }>;
}) {
  const filter = parseDateRangeParams(await searchParams);

  const logs = await withDbRetry(() =>
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: filter.fromDate, lte: filter.toDate },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
      include: { user: { select: { name: true, role: true } } },
    })
  );

  const data: AuditLogPageData = {
    from: filter.from,
    to: filter.to,
    logs: logs.map((l) => ({
      id: l.id,
      timestamp: l.createdAt.toISOString().replace("T", " ").slice(0, 16),
      actorName: l.user.name,
      actorRole: l.user.role,
      entityType: l.entityType,
      entityId: l.entityId,
      action: l.action,
      reason: l.reason,
      changesPreview: l.changes ? JSON.stringify(l.changes) : "—",
    })),
  };

  return <AuditLogClient data={data} />;
}
