import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { PortalShell } from "@/components/layout/PortalShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell allowedRoles={[Role.FACTORY_ADMIN]}>{children}</PortalShell>
  );
}
