import type { Metadata } from "next";
import { ResetRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  OwnerTeamWorkspace,
  type OwnerTeamData,
} from "@/components/owner/OwnerTeamWorkspace";

export const metadata: Metadata = {
  title: "Admins & Company Setup",
  description: "Manage Factory Admins, Auditors, and Company GST Profile.",
};

export const dynamic = "force-dynamic";

export default async function OwnerTeamPage() {
  const [settings, users] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        active: true,
        lockedUntil: true,
        passwordResetRequests: {
          where: { status: ResetRequestStatus.PENDING },
          select: { id: true },
        },
      },
    }),
  ]);

  const data: OwnerTeamData = {
    settings: {
      companyName: settings?.companyName ?? "",
      gstin: settings?.gstin ?? "",
      state: settings?.state ?? "",
      stateCode: settings?.stateCode ?? "",
      address: settings?.address ?? "",
      phone: settings?.phone ?? "",
      bankDetails: settings?.bankDetails ?? "",
      defaultTolerancePercent: settings
        ? settings.defaultTolerancePercent.toFixed(2)
        : "3.00",
      isConfigured: settings?.isConfigured ?? false,
    },
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      active: u.active,
      lockedUntil: u.lockedUntil?.toISOString() ?? null,
      pendingResetRequest: u.passwordResetRequests.length > 0,
    })),
  };

  return <OwnerTeamWorkspace data={data} />;
}
