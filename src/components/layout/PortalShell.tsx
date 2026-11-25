import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/roles";
import { AppShell } from "./AppShell";

export async function PortalShell({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[];
  children: ReactNode;
}) {
  let user;
  try {
    user = await requireVerifiedUser(allowedRoles);
  } catch {
    redirect("/login");
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
    select: { companyName: true, isConfigured: true },
  });

  return (
    <AppShell
      userName={user.name}
      userRole={user.role as UserRole}
      companyName={
        settings?.isConfigured && settings.companyName
          ? settings.companyName
          : "Factory Setup Pending"
      }
      isConfigured={Boolean(settings?.isConfigured)}
      mustChangePassword={user.mustChangePassword}
    >
      {children}
    </AppShell>
  );
}
