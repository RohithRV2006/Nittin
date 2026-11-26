"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  CustomerType,
  ItemCategory,
  Role,
  UnitType,
} from "@prisma/client";
import { toast } from "sonner";
import { UNIT_TYPES, USER_ROLES, isIntegerUnit } from "@/lib/enums";
import {
  adminResetUserPasswordAction,
  createUserAction,
  toggleCustomerActiveAction,
  toggleItemActiveAction,
  toggleSupplierActiveAction,
  toggleUserActiveAction,
  unlockUserAction,
  upsertCustomerAction,
  upsertCustomerPriceAction,
  upsertItemAction,
  upsertSupplierAction,
} from "@/actions/masters.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";

export interface MastersData {
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
  items: Array<{
    id: string;
    code: string;
    name: string;
    category: ItemCategory;
    unit: UnitType;
    packWeightGrams: string | null;
    unitsPerCarton: number | null;
    hsnCode: string;
    taxRate: string;
    sellingPrice: string | null;
    reorderLevel: string;
    active: boolean;
  }>;
  customers: Array<{
    id: string;
    name: string;
    type: CustomerType;
    gstin: string | null;
    state: string;
    stateCode: string;
    phone: string;
    address: string;
    creditLimit: string;
    creditDays: number;
    assignedSalesmanId: string | null;
    assignedSalesmanName: string | null;
    active: boolean;
    customPrices: Array<{ itemId: string; itemName: string; customPrice: string }>;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    gstin: string | null;
    state: string;
    stateCode: string;
    phone: string | null;
    address: string | null;
    active: boolean;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: Role;
    phone: string | null;
    active: boolean;
    lockedUntil: string | null;
    pendingResetRequest?: boolean;
  }>;
}

type TabKey = "items" | "customers" | "suppliers" | "users";

const inputCls =
  "h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-secondary)]";

export function MastersWorkspace({ data }: { data: MastersData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<TabKey>("items");

  // Item drawer
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [itemForm, setItemForm] = useState<{
    id?: string;
    code: string;
    name: string;
    category: ItemCategory;
    unit: UnitType;
    packWeightGrams: string;
    unitsPerCarton: string;
    hsnCode: string;
    taxRate: string;
    sellingPrice: string;
    reorderLevel: string;
  }>({
    code: "",
    name: "",
    category: "RAW_MATERIAL",
    unit: "KG",
    packWeightGrams: "",
    unitsPerCarton: "",
    hsnCode: "",
    taxRate: "5.00",
    sellingPrice: "",
    reorderLevel: "0",
  });

  // Customer drawer
  const [custDrawerOpen, setCustDrawerOpen] = useState(false);
  const [custForm, setCustForm] = useState<{
    id?: string;
    name: string;
    type: CustomerType;
    gstin: string;
    state: string;
    stateCode: string;
    phone: string;
    address: string;
    creditLimit: string;
    creditDays: string;
    assignedSalesmanId: string;
  }>({
    name: "",
    type: "RETAILER",
    gstin: "",
    state: "",
    stateCode: "",
    phone: "",
    address: "",
    creditLimit: "0",
    creditDays: "30",
    assignedSalesmanId: "",
  });

  // Customer custom price drawer
  const [priceDrawerCustomer, setPriceDrawerCustomer] = useState<
    MastersData["customers"][number] | null
  >(null);
  const [priceItemId, setPriceItemId] = useState("");
  const [customPriceVal, setCustomPriceVal] = useState("");

  // Supplier drawer
  const [supDrawerOpen, setSupDrawerOpen] = useState(false);
  const [supForm, setSupForm] = useState<{
    id?: string;
    name: string;
    gstin: string;
    state: string;
    stateCode: string;
    phone: string;
    address: string;
  }>({
    name: "",
    gstin: "",
    state: "",
    stateCode: "",
    phone: "",
    address: "",
  });

  // User drawer
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [resetPwdTarget, setResetPwdTarget] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [tempPassword, setTempPassword] = useState("");
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
    role: "SALESMAN",
    phone: "",
  });

  const salesmen = data.users.filter((u) => u.role === "SALESMAN" && u.active);
  const finishedItems = data.items.filter(
    (i) => i.category === "FINISHED_GOOD" && i.active
  );

  const runAction = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Operation failed");
        return;
      }
      toast.success(msg);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Catalog & Staff"
        subtitle="Manage SKUs, customers, suppliers, and floor/sales staff access"
      />

      {!data.settings.isConfigured ? (
        <InlineAlert variant="warning" title="Company GST Profile Setup Required">
          Company GSTIN and operating state code have not been configured yet. Ask the{" "}
          <strong>Business Owner</strong> to save the company GST profile before raising invoices or purchases.
        </InlineAlert>
      ) : null}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[var(--border-default)] pb-3">
        {(
          [
            ["items", `Items (${data.items.length})`],
            ["customers", `Customers (${data.customers.length})`],
            ["suppliers", `Suppliers (${data.suppliers.length})`],
            ["users", `Users & Roles (${data.users.length})`],
          ] as Array<[TabKey, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-h-[38px] rounded-lg px-3.5 text-sm font-medium transition ${
              tab === key
                ? "bg-[var(--brand-primary)] text-white"
                : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: Items */}
      {tab === "items" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setItemForm({
                  code: "",
                  name: "",
                  category: "RAW_MATERIAL",
                  unit: "KG",
                  packWeightGrams: "",
                  unitsPerCarton: "",
                  hsnCode: "",
                  taxRate: "5.00",
                  sellingPrice: "",
                  reorderLevel: "0",
                });
                setItemDrawerOpen(true);
              }}
              className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
            >
              + Add Item
            </button>
          </div>

          <ResponsiveTable
            data={data.items}
            keyExtractor={(r) => r.id}
            mobileTitle={(r) => r.name}
            mobileSubtitle={(r) => (
              <StatusBadge
                status={r.active ? "SUFFICIENT" : "CANCELLED"}
                customLabel={r.active ? "Active" : "Inactive"}
              />
            )}
            columns={[
              {
                key: "code",
                header: "SKU",
                render: (r) => <span className="font-mono text-xs">{r.code}</span>,
              },
              { key: "name", header: "Item Name", render: (r) => r.name },
              {
                key: "category",
                header: "Category",
                render: (r) => (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {r.category.replace("_", " ")}
                  </span>
                ),
              },
              { key: "unit", header: "Base Unit", render: (r) => r.unit },
              {
                key: "hsn",
                header: "HSN / GST",
                render: (r) => (
                  <span className="font-mono text-xs">
                    {r.hsnCode} ({r.taxRate}%)
                  </span>
                ),
              },
              {
                key: "price",
                header: "Selling Price",
                align: "right",
                render: (r) => (r.sellingPrice ? `₹${r.sellingPrice}` : "—"),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <StatusBadge
                    status={r.active ? "SUFFICIENT" : "CANCELLED"}
                    customLabel={r.active ? "Active" : "Inactive"}
                  />
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (r) => (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setItemForm({
                          id: r.id,
                          code: r.code,
                          name: r.name,
                          category: r.category,
                          unit: r.unit,
                          packWeightGrams: r.packWeightGrams ?? "",
                          unitsPerCarton: r.unitsPerCarton ? String(r.unitsPerCarton) : "",
                          hsnCode: r.hsnCode,
                          taxRate: r.taxRate,
                          sellingPrice: r.sellingPrice ?? "",
                          reorderLevel: r.reorderLevel,
                        });
                        setItemDrawerOpen(true);
                      }}
                      className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          () => toggleItemActiveAction(r.id, !r.active),
                          `Item ${r.active ? "deactivated" : "reactivated"}.`
                        )
                      }
                      className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {r.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      {/* TAB 3: Customers */}
      {tab === "customers" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setCustForm({
                  name: "",
                  type: "RETAILER",
                  gstin: "",
                  state: "",
                  stateCode: "",
                  phone: "",
                  address: "",
                  creditLimit: "0",
                  creditDays: "30",
                  assignedSalesmanId: "",
                });
                setCustDrawerOpen(true);
              }}
              className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
            >
              + Add Customer
            </button>
          </div>

          <ResponsiveTable
            data={data.customers}
            keyExtractor={(r) => r.id}
            mobileTitle={(r) => r.name}
            mobileSubtitle={(r) => (
              <StatusBadge
                status={r.active ? "SUFFICIENT" : "CANCELLED"}
                customLabel={r.active ? "Active" : "Inactive"}
              />
            )}
            columns={[
              { key: "name", header: "Customer", render: (r) => r.name },
              { key: "type", header: "Type", render: (r) => r.type },
              {
                key: "state",
                header: "State",
                render: (r) => `${r.state} (${r.stateCode})`,
              },
              {
                key: "gstin",
                header: "GSTIN",
                render: (r) => (
                  <span className="font-mono text-xs">{r.gstin ?? "Unregistered"}</span>
                ),
              },
              {
                key: "salesman",
                header: "Salesman",
                render: (r) => r.assignedSalesmanName ?? "Unassigned",
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (r) => (
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPriceDrawerCustomer(r);
                        setPriceItemId(finishedItems[0]?.id ?? "");
                        setCustomPriceVal("");
                      }}
                      className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                    >
                      Rates ({r.customPrices.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustForm({
                          id: r.id,
                          name: r.name,
                          type: r.type,
                          gstin: r.gstin ?? "",
                          state: r.state,
                          stateCode: r.stateCode,
                          phone: r.phone,
                          address: r.address,
                          creditLimit: r.creditLimit,
                          creditDays: String(r.creditDays),
                          assignedSalesmanId: r.assignedSalesmanId ?? "",
                        });
                        setCustDrawerOpen(true);
                      }}
                      className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          () => toggleCustomerActiveAction(r.id, !r.active),
                          `Customer ${r.active ? "deactivated" : "reactivated"}.`
                        )
                      }
                      className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {r.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      {/* TAB 4: Suppliers */}
      {tab === "suppliers" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSupForm({
                  name: "",
                  gstin: "",
                  state: "",
                  stateCode: "",
                  phone: "",
                  address: "",
                });
                setSupDrawerOpen(true);
              }}
              className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
            >
              + Add Supplier
            </button>
          </div>

          <ResponsiveTable
            data={data.suppliers}
            keyExtractor={(r) => r.id}
            mobileTitle={(r) => r.name}
            columns={[
              { key: "name", header: "Supplier", render: (r) => r.name },
              {
                key: "state",
                header: "State",
                render: (r) => `${r.state} (${r.stateCode})`,
              },
              {
                key: "gstin",
                header: "GSTIN",
                render: (r) => <span className="font-mono text-xs">{r.gstin ?? "—"}</span>,
              },
              { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <StatusBadge
                    status={r.active ? "SUFFICIENT" : "CANCELLED"}
                    customLabel={r.active ? "Active" : "Inactive"}
                  />
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (r) => (
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSupForm({
                          id: r.id,
                          name: r.name,
                          gstin: r.gstin ?? "",
                          state: r.state,
                          stateCode: r.stateCode,
                          phone: r.phone ?? "",
                          address: r.address ?? "",
                        });
                        setSupDrawerOpen(true);
                      }}
                      className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          () => toggleSupplierActiveAction(r.id, !r.active),
                          `Supplier ${r.active ? "deactivated" : "reactivated"}.`
                        )
                      }
                      className="text-xs font-medium text-[var(--text-muted)]"
                    >
                      {r.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      {/* TAB 5: Users & Roles */}
      {tab === "users" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setUserForm({
                  name: "",
                  email: "",
                  password: "",
                  role: "SALESMAN",
                  phone: "",
                });
                setUserDrawerOpen(true);
              }}
              className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
            >
              + Create Staff Account
            </button>
          </div>

          <ResponsiveTable
            data={data.users}
            keyExtractor={(r) => r.id}
            mobileTitle={(r) => r.name}
            columns={[
              { key: "name", header: "Name", render: (r) => r.name },
              { key: "email", header: "Email", render: (r) => r.email },
              {
                key: "role",
                header: "Role",
                render: (r) => ROLE_LABELS[r.role as UserRole],
              },
              {
                key: "status",
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
                  r.role === "OWNER" || r.role === "FACTORY_ADMIN" ? (
                    <span className="text-xs text-[var(--text-muted)]">
                      Managed by Owner
                    </span>
                  ) : (
                    <div className="flex justify-end gap-3">
                      {r.lockedUntil && new Date(r.lockedUntil) > new Date() ? (
                        <button
                          type="button"
                          onClick={() =>
                            runAction(() => unlockUserAction(r.id), "Account unlocked.")
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
                          setResetPwdTarget({ id: r.id, name: r.name, email: r.email });
                        }}
                        className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
                      >
                        Reset Password
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(
                            () => toggleUserActiveAction(r.id, !r.active),
                            `User ${r.active ? "deactivated & sessions revoked" : "reactivated"}.`
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
      ) : null}

      {/* Item SlideOver */}
      <SlideOverDrawer
        open={itemDrawerOpen}
        onClose={() => setItemDrawerOpen(false)}
        title={itemForm.id ? "Edit Item" : "New Catalog Item"}
        subtitle="Raw materials, packaging supplies, or finished snack SKUs"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(async () => {
              const res = await upsertItemAction({
                ...itemForm,
                packWeightGrams: itemForm.packWeightGrams || null,
                unitsPerCarton: itemForm.unitsPerCarton || null,
                sellingPrice: itemForm.sellingPrice || null,
              });
              if (res.ok) setItemDrawerOpen(false);
              return res;
            }, "Item saved.");
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>SKU Code</label>
              <input
                className={`${inputCls} font-mono uppercase`}
                required
                value={itemForm.code}
                onChange={(e) =>
                  setItemForm({ ...itemForm, code: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select
                className={inputCls}
                value={itemForm.category}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    category: e.target.value as ItemCategory,
                  })
                }
              >
                <option value="RAW_MATERIAL">Raw Material</option>
                <option value="PACKAGING">Packaging</option>
                <option value="FINISHED_GOOD">Finished Good</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Item Name</label>
              <input
                className={inputCls}
                required
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Base Ledger Unit</label>
              <select
                className={inputCls}
                value={itemForm.unit}
                onChange={(e) =>
                  setItemForm({ ...itemForm, unit: e.target.value as UnitType })
                }
              >
                {UNIT_TYPES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>HSN Code</label>
              <input
                className={`${inputCls} font-mono`}
                required
                value={itemForm.hsnCode}
                onChange={(e) =>
                  setItemForm({ ...itemForm, hsnCode: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>GST Rate (%)</label>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                required
                value={itemForm.taxRate}
                onChange={(e) =>
                  setItemForm({ ...itemForm, taxRate: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Selling Price (₹ pre-tax)</label>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={itemForm.sellingPrice}
                onChange={(e) =>
                  setItemForm({ ...itemForm, sellingPrice: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Pack Weight (g, optional)</label>
              <input
                type="number"
                step="0.001"
                className={inputCls}
                value={itemForm.packWeightGrams}
                onChange={(e) =>
                  setItemForm({ ...itemForm, packWeightGrams: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Packets per Carton (optional)</label>
              <input
                type="number"
                className={inputCls}
                value={itemForm.unitsPerCarton}
                onChange={(e) =>
                  setItemForm({ ...itemForm, unitsPerCarton: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Reorder Level</label>
              <input
                type="number"
                step={isIntegerUnit(itemForm.unit) ? "1" : "0.001"}
                min="0"
                inputMode={isIntegerUnit(itemForm.unit) ? "numeric" : "decimal"}
                className={inputCls}
                value={itemForm.reorderLevel}
                onChange={(e) =>
                  setItemForm({ ...itemForm, reorderLevel: e.target.value })
                }
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save Item"}
          </button>
        </form>
      </SlideOverDrawer>

      {/* Customer SlideOver */}
      <SlideOverDrawer
        open={custDrawerOpen}
        onClose={() => setCustDrawerOpen(false)}
        title={custForm.id ? "Edit Customer" : "New Customer"}
        subtitle="Retailer or wholesale distributor GST profile"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(async () => {
              const res = await upsertCustomerAction(custForm);
              if (res.ok) setCustDrawerOpen(false);
              return res;
            }, "Customer saved.");
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Business Name</label>
              <input
                className={inputCls}
                required
                value={custForm.name}
                onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Customer Type</label>
              <select
                className={inputCls}
                value={custForm.type}
                onChange={(e) =>
                  setCustForm({
                    ...custForm,
                    type: e.target.value as CustomerType,
                  })
                }
              >
                <option value="RETAILER">Retailer</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>GSTIN (optional)</label>
              <input
                className={`${inputCls} font-mono uppercase`}
                maxLength={15}
                value={custForm.gstin}
                onChange={(e) =>
                  setCustForm({ ...custForm, gstin: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div>
              <label className={labelCls}>State Name</label>
              <input
                className={inputCls}
                required
                value={custForm.state}
                onChange={(e) => setCustForm({ ...custForm, state: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>2-Digit State Code</label>
              <input
                className={`${inputCls} font-mono`}
                required
                maxLength={2}
                value={custForm.stateCode}
                onChange={(e) =>
                  setCustForm({ ...custForm, stateCode: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Phone (WhatsApp)</label>
              <input
                className={inputCls}
                required
                value={custForm.phone}
                onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Assigned Salesman</label>
              <select
                className={inputCls}
                value={custForm.assignedSalesmanId}
                onChange={(e) =>
                  setCustForm({ ...custForm, assignedSalesmanId: e.target.value })
                }
              >
                <option value="">Open Territory (Any)</option>
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Delivery & Billing Address</label>
              <input
                className={inputCls}
                required
                value={custForm.address}
                onChange={(e) =>
                  setCustForm({ ...custForm, address: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Credit Limit (₹)</label>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={custForm.creditLimit}
                onChange={(e) =>
                  setCustForm({ ...custForm, creditLimit: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Credit Days</label>
              <input
                type="number"
                className={inputCls}
                value={custForm.creditDays}
                onChange={(e) =>
                  setCustForm({ ...custForm, creditDays: e.target.value })
                }
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save Customer"}
          </button>
        </form>
      </SlideOverDrawer>

      {/* Customer Price Override SlideOver */}
      <SlideOverDrawer
        open={Boolean(priceDrawerCustomer)}
        onClose={() => setPriceDrawerCustomer(null)}
        title={`Custom Rates — ${priceDrawerCustomer?.name ?? ""}`}
        subtitle="Optional customer-specific selling prices overriding standard catalog prices"
      >
        {priceDrawerCustomer ? (
          <div className="space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  const res = await upsertCustomerPriceAction({
                    customerId: priceDrawerCustomer.id,
                    itemId: priceItemId,
                    customPrice: customPriceVal,
                  });
                  if (res.ok) setPriceDrawerCustomer(null);
                  return res;
                }, "Custom customer rate saved.");
              }}
              className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4"
            >
              <div>
                <label className={labelCls}>Finished Product</label>
                <select
                  className={inputCls}
                  required
                  value={priceItemId}
                  onChange={(e) => setPriceItemId(e.target.value)}
                >
                  <option value="">Select product...</option>
                  {finishedItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Std: ₹{i.sellingPrice ?? "0.00"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Custom Pre-Tax Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className={inputCls}
                  value={customPriceVal}
                  onChange={(e) => setCustomPriceVal(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
              >
                Save Custom Rate
              </button>
            </form>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Configured Overrides
              </h3>
              {priceDrawerCustomer.customPrices.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  No custom overrides set. Standard catalog prices apply.
                </p>
              ) : (
                priceDrawerCustomer.customPrices.map((cp) => (
                  <div
                    key={cp.itemId}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm"
                  >
                    <span>{cp.itemName}</span>
                    <span className="font-semibold tabular-nums">₹{cp.customPrice}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </SlideOverDrawer>

      {/* Supplier SlideOver */}
      <SlideOverDrawer
        open={supDrawerOpen}
        onClose={() => setSupDrawerOpen(false)}
        title={supForm.id ? "Edit Supplier" : "New Supplier"}
        subtitle="Raw material & packaging vendor master"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(async () => {
              const res = await upsertSupplierAction(supForm);
              if (res.ok) setSupDrawerOpen(false);
              return res;
            }, "Supplier saved.");
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Vendor Name</label>
            <input
              className={inputCls}
              required
              value={supForm.name}
              onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>GSTIN (optional)</label>
              <input
                className={`${inputCls} font-mono uppercase`}
                maxLength={15}
                value={supForm.gstin}
                onChange={(e) =>
                  setSupForm({ ...supForm, gstin: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                className={inputCls}
                value={supForm.phone}
                onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>State Name</label>
              <input
                className={inputCls}
                required
                value={supForm.state}
                onChange={(e) => setSupForm({ ...supForm, state: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>2-Digit State Code</label>
              <input
                className={`${inputCls} font-mono`}
                required
                maxLength={2}
                value={supForm.stateCode}
                onChange={(e) =>
                  setSupForm({ ...supForm, stateCode: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <input
              className={inputCls}
              value={supForm.address}
              onChange={(e) => setSupForm({ ...supForm, address: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
          >
            Save Supplier
          </button>
        </form>
      </SlideOverDrawer>

      {/* User SlideOver */}
      <SlideOverDrawer
        open={userDrawerOpen}
        onClose={() => setUserDrawerOpen(false)}
        title="Create Staff Account"
        subtitle="Role-scoped credentials for factory, field, or audit staff"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(async () => {
              const res = await createUserAction(userForm);
              if (res.ok) setUserDrawerOpen(false);
              return res;
            }, "Staff account created.");
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
            <label className={labelCls}>Temporary Password (min 8 chars, letter + number)</label>
            <PasswordInput
              minLength={8}
              required
              value={userForm.password}
              onChange={(e) =>
                setUserForm({ ...userForm, password: e.target.value })
              }
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
              {USER_ROLES.filter((r) => r !== "OWNER" && r !== "FACTORY_ADMIN").map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r as UserRole]}
                </option>
              ))}
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

      {/* Admin Reset Password Drawer */}
      <SlideOverDrawer
        open={Boolean(resetPwdTarget)}
        onClose={() => setResetPwdTarget(null)}
        title={`Reset Password — ${resetPwdTarget?.name ?? ""}`}
        subtitle="Issues a temporary password and revokes active sessions"
      >
        {resetPwdTarget ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                const res = await adminResetUserPasswordAction({
                  userId: resetPwdTarget.id,
                  temporaryPassword: tempPassword,
                });
                if (res.ok) {
                  setResetPwdTarget(null);
                  setTempPassword("");
                }
                return res;
              }, `Temporary password set for ${resetPwdTarget.email}.`);
            }}
            className="space-y-4"
          >
            <p className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)]">
              Account: <strong>{resetPwdTarget.email}</strong>. The user will be prompted to set a new personal password after signing in.
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
              className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
            >
              {isPending ? "Updating..." : "Reset Password & Revoke Sessions"}
            </button>
          </form>
        ) : null}
      </SlideOverDrawer>
    </div>
  );
}
