"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { logoutAction } from "@/actions/auth.actions";
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
    { href: "/production", label: "Production Floor", icon: "factory" },
    { href: "/auditor", label: "Audit Reports", icon: "spreadsheet" },
    { href: "/dashboard", label: "Owner KPIs", icon: "chart" },
  ],
  PRODUCTION_SUPERVISOR: [
    { href: "/production", label: "Floor Overview", icon: "factory", mobilePrimary: true },
    { href: "/production/new-run", label: "New Batch Run", icon: "plus", mobilePrimary: true },
    { href: "/production/boms", label: "BOM Recipes", icon: "book", mobilePrimary: true },
  ],
  AUDITOR: [
    { href: "/auditor", label: "Report Center", icon: "home", mobilePrimary: true },
    { href: "/auditor/sales-register", label: "Sales Register", icon: "file" },
    { href: "/auditor/gst-summary", label: "GST Summary", icon: "scale" },
    { href: "/auditor/purchase-register", label: "Purchase Register", icon: "bag" },
    { href: "/auditor/stock-ledger", label: "Stock Ledger", icon: "package", mobilePrimary: true },
    { href: "/auditor/production-report", label: "Production Report", icon: "activity" },
    { href: "/auditor/receivables", label: "Receivables & Dues", icon: "rupee", mobilePrimary: true },
    { href: "/auditor/audit-log", label: "Audit Trail", icon: "shield" },
  ],
  OWNER: [
    { href: "/dashboard", label: "Executive Dashboard", icon: "chart", mobilePrimary: true },
    { href: "/auditor/stock-ledger", label: "Stock Ledger", icon: "package", mobilePrimary: true },
    { href: "/auditor/production-report", label: "Production Variance", icon: "activity" },
    { href: "/auditor/receivables", label: "Receivables", icon: "rupee", mobilePrimary: true },
  ],
};

interface AppShellProps {
  userName: string;
  userRole: UserRole;
  companyName: string;
  isConfigured: boolean;
  children: ReactNode;
}

export function AppShell({
  userName,
  userRole,
  companyName,
  isConfigured,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [online, setOnline] = useState(true);

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
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Desktop Persistent Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#E2E8F0] bg-white lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-[#E2E8F0] px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#047857] text-sm font-bold text-white">
            N
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#0F172A]">Nittin ERP</p>
            <p className="truncate text-[11px] text-[#64748B]">{companyName}</p>
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
                    ? "bg-[#ECFDF5] text-[#047857]"
                    : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#E2E8F0] p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-xs font-medium text-[#0F172A]">{userName}</p>
            <p className="truncate text-[11px] text-[#64748B]">{ROLE_LABELS[userRole]}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#475569] transition hover:bg-[#F1F5F9] hover:text-[#B91C1C]"
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
            className="fixed inset-0 bg-[#0F172A]/40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-[#E2E8F0] px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#047857] text-xs font-bold text-white">
                  N
                </div>
                <span className="text-sm font-semibold text-[#0F172A]">Nittin ERP</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9]"
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
                        ? "bg-[#ECFDF5] text-[#047857]"
                        : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-[#E2E8F0] p-4">
              <p className="text-xs font-medium text-[#0F172A]">{userName}</p>
              <p className="mb-3 text-[11px] text-[#64748B]">{ROLE_LABELS[userRole]}</p>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 text-sm font-medium text-[#475569] hover:bg-[#FEF2F2] hover:text-[#B91C1C]"
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-[#475569] hover:bg-[#F1F5F9] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-[#475569] lg:hidden">
              {companyName}
            </span>
            <span className="hidden rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-xs font-medium text-[#475569] lg:inline-flex">
              {ROLE_LABELS[userRole]}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {!isConfigured && userRole === "FACTORY_ADMIN" ? (
              <Link
                href="/admin/masters"
                className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#B45309]"
              >
                Setup Factory Profile
              </Link>
            ) : null}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                online
                  ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]"
                  : "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]"
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
          </div>
        </header>

        {/* Page Body */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-6 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      {mobileBottomItems.length > 0 ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-[#E2E8F0] bg-white px-2 lg:hidden">
          {mobileBottomItems.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium ${
                  active ? "text-[#047857]" : "text-[#64748B]"
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
