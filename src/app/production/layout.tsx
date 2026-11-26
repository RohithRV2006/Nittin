import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { PortalShell } from "@/components/layout/PortalShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ProductionLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell allowedRoles={[Role.PRODUCTION_SUPERVISOR]}>
      {children}
    </PortalShell>
  );
}
