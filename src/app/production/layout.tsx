import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { PortalShell } from "@/components/layout/PortalShell";

export default function ProductionLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell allowedRoles={[Role.PRODUCTION_SUPERVISOR]}>
      {children}
    </PortalShell>
  );
}
