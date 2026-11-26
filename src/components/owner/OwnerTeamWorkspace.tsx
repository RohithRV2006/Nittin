"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { toast } from "sonner";
import {
  ownerCreateTeamUserAction,
  ownerResetUserPasswordAction,
  ownerToggleUserActiveAction,
  ownerUnlockUserAction,
  ownerUpdateCompanySettingsAction,
} from "@/actions/owner.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";

export interface OwnerTeamData {
  settings: {
    companyName: string;
    gstin: string;
    state: string;
    stateCode: string;
    address: string;
    phone: string;
    bankDetails: string;
    defaultTolerancePercent: string;
    isConfigured: boolean;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: Role;
    phone: string | null;
    active: boolean;
    lockedUntil: string | null;
    pendingResetRequest: boolean;
  }>;
}

const inputCls =
  "h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-secondary)]";

export function OwnerTeamWorkspace({ data }: { data: OwnerTeamData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"admins" | "company">(
    data.settings.isConfigured ? "admins" : "company"
  );

  const [settingsForm, setSettingsForm] = useState(data.settings);
  const [createOpen, setCreateOpen] = useState(false);
  const [userForm, setUserForm] = useState<{
    name: string;
    email: string;
    password: string;
    role: Role;
    phone: string;
  }>({
    name: "",
    email: "",
    password: "",
    role: "FACTORY_ADMIN",
    phone: "",
  });

  const [resetTarget, setResetTarget] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [tempPassword, setTempPassword] = useState("");

  const runAction = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Action failed");
        return;
      }
      toast.success(msg);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admins & Company Governance"
        subtitle="Manage Factory Admins, Auditors, and legal GST profile"
      />

      {!data.settings.isConfigured ? (
        <InlineAlert variant="warning" title="Company GST Profile Setup Required">
          Configure your company legal name, GSTIN, and state code before Factory Admins start billing.
        </InlineAlert>
      ) : null}

      <div className="flex gap-2 border-b border-[var(--border-default)] pb-3">
        <button
          type="button"
          onClick={() => setTab("admins")}
          className={`h-9 rounded-lg px-3.5 text-sm font-medium ${
            tab === "admins"
              ? "bg-[var(--brand-primary)] text-white"
              : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
          }`}
        >
          Factory Admins & Team ({data.users.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("company")}
          className={`h-9 rounded-lg px-3.5 text-sm font-medium ${
            tab === "company"
              ? "bg-[var(--brand-primary)] text-white"
              : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
          }`}
        >
          Company GST Profile
        </button>
      </div>

      {tab === "admins" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              Create and manage Factory Admins & Auditors. Operational floor/sales staff can also be managed by Factory Admins.
            </p>
            <button
              type="button"
              onClick={() => {
                setUserForm({
                  name: "",
                  email: "",
                  password: "",
                  role: "FACTORY_ADMIN",
                  phone: "",
                });
                setCreateOpen(true);
              }}
              className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
            >
              + Create Factory Admin / Auditor
            </button>
          </div>

          <ResponsiveTable
            data={data.users}
            keyExtractor={(r) => r.id}
            mobileTitle={(r) => r.name}
            mobileSubtitle={(r) => ROLE_LABELS[r.role as UserRole]}
            columns={[
              { key: "name", header: "Name", render: (r) => r.name },
              { key: "email", header: "Email", render: (r) => r.email },
              {
                key: "role",
                header: "Role",
                render: (r) => ROLE_LABELS[r.role as UserRole],
              },
              {
                key: "state",
                header: "Account State",
                render: (r) => {
                  const locked =
                    r.lockedUntil && new Date(r.lockedUntil) > new Date();
                  if (locked) {
                    return <StatusBadge status="ON_HOLD" customLabel="Locked" />;
                  }
                  if (r.pendingResetRequest) {
                    return <StatusBadge status="ON_HOLD" customLabel="Reset Requested" />;
                  }
                  return (
                    <StatusBadge
                      status={r.active ? "SUFFICIENT" : "CANCELLED"}
                      customLabel={r.active ? "Active" : "Deactivated"}
                    />
                  );
                },
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (r) =>
                  r.role === "OWNER" ? (
                    <span className="text-xs text-[var(--text-muted)]">Primary Owner</span>
                  ) : (
                    <div className="flex justify-end gap-3">
                      {r.lockedUntil && new Date(r.lockedUntil) > new Date() ? (
                        <button
                          type="button"
                          onClick={() =>
                            runAction(() => ownerUnlockUserAction(r.id), "Account unlocked.")
                          }
                          className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
                        >
                          Unlock
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setTempPassword("");
                          setResetTarget({ id: r.id, name: r.name, email: r.email });
                        }}
                        className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
                      >
                        Reset Password
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(
                            () => ownerToggleUserActiveAction(r.id, !r.active),
                            `Account ${r.active ? "deactivated & sessions revoked" : "reactivated"}.`
                          )
                        }
                        className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        {r.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  ),
              },
            ]}
          />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              () => ownerUpdateCompanySettingsAction(settingsForm),
              "Company GST profile saved."
            );
          }}
          className="max-w-3xl space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6"
        >
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Legal Entity & GST Profile
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Company Legal Name</label>
              <input
                className={inputCls}
                required
                value={settingsForm.companyName}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, companyName: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>GSTIN (15 characters)</label>
              <input
                className={`${inputCls} font-mono uppercase`}
                required
                value={settingsForm.gstin}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    gstin: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Operating State</label>
              <input
                className={inputCls}
                required
                value={settingsForm.state}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, state: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>GST State Code (2 digits)</label>
              <input
                className={`${inputCls} font-mono`}
                required
                maxLength={2}
                value={settingsForm.stateCode}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, stateCode: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Registered Factory Address</label>
            <input
              className={inputCls}
              required
              value={settingsForm.address}
              onChange={(e) =>
                setSettingsForm({ ...settingsForm, address: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Phone</label>
              <input
                className={inputCls}
                value={settingsForm.phone}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, phone: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Default BOM Variance Tolerance (%)</label>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={settingsForm.defaultTolerancePercent}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    defaultTolerancePercent: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Bank Details (Shown on Tax Invoices)</label>
            <input
              className={inputCls}
              value={settingsForm.bankDetails}
              onChange={(e) =>
                setSettingsForm({ ...settingsForm, bankDetails: e.target.value })
              }
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save Company Profile"}
          </button>
        </form>
      )}

      <SlideOverDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Factory Admin / Auditor"
        subtitle="Creates a top-level administrative or read-only statutory account"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(async () => {
              const res = await ownerCreateTeamUserAction(userForm);
              if (res.ok) setCreateOpen(false);
              return res;
            }, "Account created.");
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Full Name</label>
            <input
              className={inputCls}
              required
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input
              type="email"
              className={inputCls}
              required
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>
              Temporary Password (min 8 chars, letter + number)
            </label>
            <PasswordInput
              minLength={8}
              required
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select
              className={inputCls}
              value={userForm.role}
              onChange={(e) =>
                setUserForm({ ...userForm, role: e.target.value as Role })
              }
            >
              <option value="FACTORY_ADMIN">Factory Admin</option>
              <option value="AUDITOR">Auditor / Accountant</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Phone (optional)</label>
            <input
              className={inputCls}
              value={userForm.phone}
              onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
          >
            Create Account
          </button>
        </form>
      </SlideOverDrawer>

      <SlideOverDrawer
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Reset Password — ${resetTarget?.name ?? ""}`}
        subtitle="Issues a temporary password and revokes active sessions"
      >
        {resetTarget ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                const res = await ownerResetUserPasswordAction({
                  userId: resetTarget.id,
                  temporaryPassword: tempPassword,
                });
                if (res.ok) {
                  setResetTarget(null);
                  setTempPassword("");
                }
                return res;
              }, `Temporary password set for ${resetTarget.email}.`);
            }}
            className="space-y-4"
          >
            <p className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)]">
              Account: <strong>{resetTarget.email}</strong>
            </p>
            <div>
              <label className={labelCls}>
                New Temporary Password (min 8 chars, letter + number)
              </label>
              <PasswordInput
                minLength={8}
                required
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
            >
              Reset Password & Revoke Sessions
            </button>
          </form>
        ) : null}
      </SlideOverDrawer>
    </div>
  );
}
