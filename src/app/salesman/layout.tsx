import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { PortalShell } from "@/components/layout/PortalShell";

export default function SalesmanLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell allowedRoles={[Role.SALESMAN]}>{children}</PortalShell>
  );
}
