import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { isDatabaseUnavailableError } from "@/lib/errors";
import { prisma, withDbRetry } from "@/lib/prisma";
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
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      redirect("/");
    }
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      // Clear stale/revoked session cookie via logout route so middleware never loops
      redirect("/api/auth/logout");
    }
    if (isDatabaseUnavailableError(err)) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] px-4 text-center">
          <div className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 shadow-sm">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Temporarily Unable to Connect
            </h1>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              The server could not reach the database right now. Your session is safe — please wait a moment and retry.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <a
                href=""
                className="inline-flex h-9 items-center rounded-lg bg-[var(--brand-primary)] px-4 text-xs font-semibold text-white hover:bg-[var(--brand-hover)]"
              >
                Retry Connection
              </a>
            </div>
          </div>
        </main>
      );
    }
    redirect("/api/auth/logout");
  }

  let settings: { companyName: string; isConfigured: boolean } | null = null;
  try {
    settings = await withDbRetry(() =>
      prisma.companySettings.findUnique({
        where: { id: "default" },
        select: { companyName: true, isConfigured: true },
      })
    );
  } catch {
    settings = null;
  }

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
