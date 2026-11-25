"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Database,
  Factory,
  FileSpreadsheet,
  FileText,
  Home,
  IndianRupee,
  KeyRound,
  LogOut,
  Menu,
  PackageCheck,
  PlusCircle,
  Receipt,
  Scale,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { changeOwnPasswordAction, logoutAction } from "@/actions/auth.actions";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";

export type NavIconKey =
  | "home"
  | "plus"
  | "orders"
  | "clipboard"
  | "receipt"
  | "bag"
  | "rupee"
  | "sliders"
  | "database"
  | "factory"
  | "book"
  | "chart"
  | "file"
  | "scale"
  | "package"
  | "activity"
  | "shield"
  | "users"
  | "spreadsheet";

const ICONS: Record<NavIconKey, typeof Home> = {
  home: Home,
  plus: PlusCircle,
  orders: ClipboardList,
  clipboard: ClipboardCheck,
  receipt: Receipt,
  bag: ShoppingBag,
  rupee: IndianRupee,
  sliders: SlidersHorizontal,
  database: Database,
  factory: Factory,
  book: BookOpen,
  chart: BarChart3,
  file: FileText,
  scale: Scale,
  package: PackageCheck,
  activity: Activity,
  shield: ShieldCheck,
  users: Users,
  spreadsheet: FileSpreadsheet,
};

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  mobilePrimary?: boolean;
}

// Strict 1-role-per-portal navigation
export const ROLE_NAV_ITEMS: Record<UserRole, NavItem[]> = {
  SALESMAN: [
    { href: "/salesman", label: "Home", icon: "home", mobilePrimary: true },
    { href: "/salesman/new-order", label: "New Order", icon: "plus", mobilePrimary: true },
    { href: "/salesman/orders", label: "Orders & Sales", icon: "orders", mobilePrimary: true },
  ],
  FACTORY_ADMIN: [
    { href: "/admin", label: "Command Center", icon: "home", mobilePrimary: true },
    { href: "/admin/orders", label: "Incoming Orders", icon: "clipboard", mobilePrimary: true },
    { href: "/admin/invoices", label: "Invoices & Dispatch", icon: "receipt", mobilePrimary: true },
    { href: "/admin/purchases", label: "Purchases", icon: "bag" },
    { href: "/admin/payments", label: "Payments", icon: "rupee" },
    { href: "/admin/adjustments", label: "Stock Adjustments", icon: "sliders" },
    { href: "/admin/masters", label: "Masters & Setup", icon: "database" },
  ],
  PRODUCTION_SUPERVISOR: [
    { href: "/production", label: "Floor Overview", icon: "factory", mobilePrimary: true },
    { href: "/production/new-run", label: "New Batch Run", icon: "plus", mobilePrimary: true },
    { href: "/production/receiving", label: "Goods Receipt (GRN)", icon: "package", mobilePrimary: true },
    { href: "/production/boms", label: "BOM Recipes", icon: "book" },
  ],
  AUDITOR: [
    { href: "/auditor", label: "Report Center", icon: "home", mobilePrimary: true },
    { href: "/auditor/sales-register", label: "Sales Register", icon: "file" },
    { href: "/auditor/gst-summary", label: "GST Summary", icon: "scale" },
    { href: "/auditor/purchase-register", label: "Purchase Register", icon: "bag" },
    { href: "/auditor/stock-ledger", label: "Stock Ledger", icon: "package", mobilePrimary: true },
    { href: "/auditor/production-report", label: "Production Report", icon: "activity" },
    { href: "/auditor/receivables", label: "Receivables", icon: "rupee", mobilePrimary: true },
    { href: "/auditor/audit-log", label: "Audit Trail", icon: "shield" },
  ],
  OWNER: [
    { href: "/dashboard", label: "Executive Dashboard", icon: "chart", mobilePrimary: true },
  ],
};

interface AppShellProps {
  userName: string;
  userRole: UserRole;
  companyName: string;
  isConfigured: boolean;
  mustChangePassword?: boolean;
  children: ReactNode;
}

export function AppShell({
  userName,
  userRole,
  companyName,
  isConfigured,
  mustChangePassword = false,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdChangedLocal, setPwdChangedLocal] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    setPwdSaving(true);
    try {
      const res = await changeOwnPasswordAction({
        currentPassword,
        newPassword,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update password");
        return;
      }
      toast.success("Password updated securely.");
      setPwdOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwdChangedLocal(true);
    } finally {
      setPwdSaving(false);
    }
  };

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const navItems = ROLE_NAV_ITEMS[userRole] ?? [];
  const mobileBottomItems = navItems.filter((item) => item.mobilePrimary).slice(0, 4);

  const isActive = (href: string) => {
    if (
      href === "/salesman" ||
      href === "/admin" ||
      href === "/production" ||
      href === "/auditor" ||
      href === "/dashboard"
    ) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Desktop Persistent Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)] lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border-default)] px-4">
          <Image
            src="/nittin.png"
            alt="Nittin Logo"
            width={34}
            height={34}
            unoptimized
            className="h-8 w-8 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
              Nittin ERP
            </p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">
              {companyName}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--brand-soft)] text-[var(--brand-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border-default)] p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-xs font-medium text-[var(--text-primary)]">
              {userName}
            </p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">
              {ROLE_LABELS[userRole]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPwdOpen(true)}
            className="mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <KeyRound className="h-4 w-4" />
            Change Password
          </button>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[#B91C1C] dark:hover:text-[#F87171]"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile / Tablet Slide-out Navigation Drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-[var(--bg-surface)] shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-[var(--border-default)] px-4">
              <div className="flex items-center gap-2">
                <Image
                  src="/nittin.png"
                  alt="Nittin Logo"
                  width={30}
                  height={30}
                  unoptimized
                  className="h-7 w-7 rounded-full object-cover"
                />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  Nittin ERP
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navItems.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-[var(--brand-soft)] text-[var(--brand-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-[var(--border-default)] p-4">
              <p className="text-xs font-medium text-[var(--text-primary)]">
                {userName}
              </p>
              <p className="mb-3 text-[11px] text-[var(--text-muted)]">
                {ROLE_LABELS[userRole]}
              </p>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setPwdOpen(true);
                }}
                className="mb-2 flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                <KeyRound className="h-4 w-4" />
                Change Password
              </button>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[#FEF2F2] hover:text-[#B91C1C]"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Main Content Wrapper */}
      <div className="flex min-h-screen flex-col lg:pl-60">
        {/* Top Utility Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <Image
                src="/nittin.png"
                alt="Nittin Logo"
                width={26}
                height={26}
                unoptimized
                className="h-6 w-6 rounded-full object-cover"
              />
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                {companyName}
              </span>
            </div>
            <span className="hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)] lg:inline-flex">
              {ROLE_LABELS[userRole]}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isConfigured && userRole === "FACTORY_ADMIN" ? (
              <Link
                href="/admin/masters"
                className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#B45309] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FBBF24]"
              >
                Setup Factory
              </Link>
            ) : null}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                online
                  ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D] dark:border-[#166534] dark:bg-[#052E16] dark:text-[#4ADE80]"
                  : "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FBBF24]"
              }`}
            >
              {online ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  Offline
                </>
              )}
            </span>
            <ThemeToggle />
          </div>
        </header>

        {/* Page Body */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-6 lg:pb-8">
          {mustChangePassword && !pwdChangedLocal ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <span>
                Your password was reset by an administrator. Please set a new personal password now.
              </span>
              <button
                type="button"
                onClick={() => setPwdOpen(true)}
                className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 font-semibold text-white hover:bg-[var(--brand-hover)]"
              >
                Update Password
              </button>
            </div>
          ) : null}
          {children}
        </main>
      </div>

      <SlideOverDrawer
        open={pwdOpen}
        onClose={() => setPwdOpen(false)}
        title="Change Account Password"
        subtitle="Minimum 8 characters with at least one letter and one number"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Current Password
            </label>
            <PasswordInput
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              New Password
            </label>
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Confirm New Password
            </label>
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={pwdSaving}
            className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {pwdSaving ? "Updating..." : "Save New Password"}
          </button>
        </form>
      </SlideOverDrawer>

      {/* Mobile Bottom Navigation Bar */}
      {mobileBottomItems.length > 0 ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-2 lg:hidden">
          {mobileBottomItems.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium ${
                  active
                    ? "text-[var(--brand-primary)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
