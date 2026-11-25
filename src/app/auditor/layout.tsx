import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { PortalShell } from "@/components/layout/PortalShell";

export default function AuditorLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell
      allowedRoles={[Role.AUDITOR, Role.FACTORY_ADMIN, Role.OWNER]}
    >
      {children}
    </PortalShell>
  );
}
