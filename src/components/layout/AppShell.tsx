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
  PanelLeftClose,
  PanelLeftOpen,
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
import { useNetworkOnline } from "@/lib/network";
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
  group?: string;
  mobilePrimary?: boolean;
}

// Strict 1-role-per-portal navigation grouped by business workflow
export const ROLE_NAV_ITEMS: Record<UserRole, NavItem[]> = {
  SALESMAN: [
    { href: "/salesman", label: "Home", icon: "home", group: "Field Workflow", mobilePrimary: true },
    { href: "/salesman/new-order", label: "1. New Field Order", icon: "plus", group: "Field Workflow", mobilePrimary: true },
    { href: "/salesman/orders", label: "2. Orders & Sales", icon: "orders", group: "Field Workflow", mobilePrimary: true },
  ],
  FACTORY_ADMIN: [
    { href: "/admin", label: "Command Center", icon: "home", group: "Overview", mobilePrimary: true },
    { href: "/admin/orders", label: "1. Incoming Orders", icon: "clipboard", group: "Sales & Cash Loop", mobilePrimary: true },
    { href: "/admin/invoices", label: "2. Invoices & Dispatch", icon: "receipt", group: "Sales & Cash Loop", mobilePrimary: true },
    { href: "/admin/payments", label: "3. Payment Collections", icon: "rupee", group: "Sales & Cash Loop" },
    { href: "/admin/purchases", label: "Purchases & GRNs", icon: "bag", group: "Factory & Catalog" },
    { href: "/admin/adjustments", label: "Stock & Adjustments", icon: "sliders", group: "Factory & Catalog" },
    { href: "/admin/boms", label: "BOM Recipes", icon: "book", group: "Factory & Catalog" },
    { href: "/admin/masters", label: "Masters & Staff", icon: "database", group: "Factory & Catalog" },
  ],
  PRODUCTION_SUPERVISOR: [
    { href: "/production", label: "Floor Overview", icon: "factory", group: "Overview", mobilePrimary: true },
    { href: "/production/receiving", label: "1. Gate Receipt (GRN)", icon: "package", group: "Floor Workflow", mobilePrimary: true },
    { href: "/production/new-run", label: "2. Batch Runs", icon: "plus", group: "Floor Workflow", mobilePrimary: true },
    { href: "/production/boms", label: "3. BOM Recipes", icon: "book", group: "Floor Workflow" },
  ],
  AUDITOR: [
    { href: "/auditor", label: "Report Center", icon: "home", group: "Overview", mobilePrimary: true },
    { href: "/auditor/sales-register", label: "Sales Register", icon: "file", group: "Statutory Registers" },
    { href: "/auditor/gst-summary", label: "GST Summary", icon: "scale", group: "Statutory Registers" },
    { href: "/auditor/purchase-register", label: "Purchase Register", icon: "bag", group: "Statutory Registers" },
    { href: "/auditor/stock-ledger", label: "Stock Ledger", icon: "package", group: "Statutory Registers", mobilePrimary: true },
    { href: "/auditor/production-report", label: "Production Report", icon: "activity", group: "Statutory Registers" },
    { href: "/auditor/receivables", label: "Receivables", icon: "rupee", group: "Statutory Registers", mobilePrimary: true },
    { href: "/auditor/audit-log", label: "Audit Trail", icon: "shield", group: "Compliance" },
  ],
  OWNER: [
    { href: "/dashboard", label: "Executive Overview", icon: "chart", group: "Control Tower", mobilePrimary: true },
    { href: "/dashboard/reports", label: "Analytics & Reports", icon: "spreadsheet", group: "Control Tower", mobilePrimary: true },
    { href: "/dashboard/audit", label: "Audit Trail", icon: "shield", group: "Governance" },
    { href: "/dashboard/team", label: "Admins & Company", icon: "users", group: "Governance", mobilePrimary: true },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const online = useNetworkOnline();
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
    try {
      setSidebarCollapsed(localStorage.getItem("nittin_sidebar_collapsed") === "1");
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (
      userRole !== "SALESMAN" ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (!online) return;
        try {
          if (sessionStorage.getItem("nittin_sw_warmed_v1") === "1") return;
          sessionStorage.setItem("nittin_sw_warmed_v1", "1");
        } catch {
          // Ignore storage errors
        }
        const worker = reg.active ?? navigator.serviceWorker.controller;
        worker?.postMessage({ type: "WARM_SALESMAN_CACHE" });
      })
      .catch(() => {
        // Ignore SW registration failure on unsupported/restricted contexts
      });
  }, [userRole, online]);

  const clearOfflineSwCache = () => {
    try {
      sessionStorage.removeItem("nittin_sw_warmed_v1");
    } catch {
      // Ignore storage errors
    }
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.controller?.postMessage({
        type: "CLEAR_SALESMAN_CACHE",
      });
    }
  };

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    closeDrawer = false
  ) => {
    if (closeDrawer) setDrawerOpen(false);
    if (!online && href !== pathname) {
      e.preventDefault();
      if (href === "/salesman" || href.startsWith("/salesman/")) {
        window.location.assign(href);
        return;
      }
      toast.info("You are offline. Reconnect before switching pages.");
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("nittin_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

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
      {/* Desktop Persistent Collapsible Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)] transition-all duration-200 lg:flex ${
          sidebarCollapsed ? "w-[72px]" : "w-60"
        }`}
      >
        <div
          className={`flex h-14 items-center border-b border-[var(--border-default)] ${
            sidebarCollapsed ? "justify-center px-2" : "gap-2.5 px-4"
          }`}
        >
          <Image
            src="/nittin.png"
            alt="Nittin Logo"
            width={34}
            height={34}
            unoptimized
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
          {!sidebarCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                Nittin ERP
              </p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">
                {companyName}
              </p>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item, idx) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            const showGroup =
              item.group && (idx === 0 || navItems[idx - 1]?.group !== item.group);
            return (
              <div key={item.href}>
                {showGroup ? (
                  sidebarCollapsed ? (
                    idx > 0 ? (
                      <div className="my-2 border-t border-[var(--border-default)]" />
                    ) : null
                  ) : (
                    <p
                      className={`px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] ${
                        idx === 0 ? "mb-1" : "mt-4 mb-1"
                      }`}
                    >
                      {item.group}
                    </p>
                  )
                ) : null}
                <Link
                  href={item.href}
                  onClick={(e) => handleLinkClick(e, item.href)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg py-2 text-sm font-medium transition ${
                    sidebarCollapsed ? "justify-center px-2" : "gap-2.5 px-3"
                  } ${
                    active
                      ? "bg-[var(--brand-soft)] text-[var(--brand-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed ? (
                    <span className="truncate">{item.label}</span>
                  ) : null}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border-default)] p-3 pb-4">
          {!sidebarCollapsed ? (
            <div className="mb-2 px-2">
              <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                {userName}
              </p>
            </div>
          ) : (
            <div
              title={userName}
              className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand-primary)]"
            >
              {userName.trim().charAt(0).toUpperCase() || "U"}
            </div>
          )}
          {userRole !== "OWNER" ? (
            <button
              type="button"
              onClick={() => setPwdOpen(true)}
              title={sidebarCollapsed ? "Change Password" : undefined}
              className={`mb-1 flex w-full items-center rounded-lg py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] ${
                sidebarCollapsed ? "justify-center px-2" : "gap-2 px-2.5"
              }`}
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed ? <span>Change Password</span> : null}
            </button>
          ) : null}
          <form action={logoutAction} onSubmit={clearOfflineSwCache}>
            <button
              type="submit"
              title={sidebarCollapsed ? "Sign Out" : undefined}
              className={`flex w-full items-center rounded-lg py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[#B91C1C] dark:hover:text-[#F87171] ${
                sidebarCollapsed ? "justify-center px-2" : "gap-2 px-2.5"
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed ? <span>Sign Out</span> : null}
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
                    onClick={(e) => handleLinkClick(e, item.href, true)}
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
              <p className="mb-3 text-xs font-medium text-[var(--text-primary)]">
                {userName}
              </p>
              {userRole !== "OWNER" ? (
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
              ) : null}
              <form action={logoutAction} onSubmit={clearOfflineSwCache}>
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
      <div
        className={`flex min-h-screen flex-col transition-all duration-200 ${
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-60"
        }`}
      >
        {/* Top Utility Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] lg:inline-flex"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
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
            {!isConfigured && userRole === "OWNER" ? (
              <Link
                href="/dashboard/team"
                className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#B45309] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FBBF24]"
              >
                Setup Company
              </Link>
            ) : !isConfigured && userRole === "FACTORY_ADMIN" ? (
              <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#B45309] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FBBF24]">
                Owner Setup Pending
              </span>
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
          {userRole !== "OWNER" && mustChangePassword && !pwdChangedLocal ? (
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

      {userRole !== "OWNER" ? (
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
      ) : null}

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
                onClick={(e) => handleLinkClick(e, item.href)}
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
