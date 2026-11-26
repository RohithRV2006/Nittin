import { describe, expect, it } from "vitest";
import { ReturnCondition, UnitType } from "@prisma/client";
import { checkRateLimit, resetRateLimitBuckets } from "@/lib/rate-limit";
import { canAccessPath } from "@/lib/roles";
import {
  createGoodsReceiptSchema,
  passwordPolicySchema,
} from "@/lib/validators/phase1";
import {
  dispatchInvoiceSchema,
  recordSalesReturnSchema,
} from "@/lib/validators/phase4";

describe("Phase 6 Production Hardening, GRN, Partial Dispatch & Sales Returns", () => {
  it("enforces sliding-window rate limits cleanly", () => {
    resetRateLimitBuckets();
    const key = "login:127.0.0.1:test@nittin.local";
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("enforces password complexity rules (min 8 chars with letter and digit)", () => {
    expect(passwordPolicySchema.safeParse("abc123").success).toBe(false);
    expect(passwordPolicySchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordPolicySchema.safeParse("12345678").success).toBe(false);
    expect(passwordPolicySchema.safeParse("Nittin2026").success).toBe(true);
  });

  it("validates partial dispatch and sales return schemas", () => {
    const uid = "11111111-1111-4111-8111-111111111111";
    const dispatchOk = dispatchInvoiceSchema.safeParse({
      invoiceId: uid,
      vehicleNumber: "TN-45-AB-1234",
      items: [{ invoiceItemId: uid, quantity: 60 }],
    });
    expect(dispatchOk.success).toBe(true);

    const returnOk = recordSalesReturnSchema.safeParse({
      invoiceId: uid,
      reason: "Damaged cartons in transit",
      items: [
        { invoiceItemId: uid, quantity: 10, condition: ReturnCondition.DAMAGED },
      ],
    });
    expect(returnOk.success).toBe(true);
  });

  it("allows Floor Supervisor access to GRN receiving without commercial admin access", () => {
    expect(canAccessPath("PRODUCTION_SUPERVISOR", "/production/receiving")).toBe(true);
    expect(canAccessPath("PRODUCTION_SUPERVISOR", "/admin/purchases")).toBe(false);
    expect(canAccessPath("OWNER", "/dashboard")).toBe(true);
    expect(canAccessPath("OWNER", "/dashboard/team")).toBe(true);
    expect(canAccessPath("FACTORY_ADMIN", "/dashboard/team")).toBe(false);

    const uid = "22222222-2222-4222-8222-222222222222";
    const grnOk = createGoodsReceiptSchema.safeParse({
      supplierId: uid,
      challanNumber: "DC-102",
      receivedDate: "2026-11-25",
      lines: [
        {
          itemId: uid,
          quantity: 50,
          inputUnit: UnitType.KG,
          batchNumber: "SUP-B1",
        },
      ],
    });
    expect(grnOk.success).toBe(true);
  });
});
