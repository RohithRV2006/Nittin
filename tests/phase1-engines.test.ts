import { describe, expect, it } from "vitest";
import { CustomerType, ItemCategory, UnitType } from "@prisma/client";
import { computeGstSplit } from "@/lib/engines/tax";
import { convertUnit } from "@/lib/units";
import { money } from "@/lib/decimal";
import {
  companySettingsSchema,
  createPurchaseSchema,
  customerSchema,
  itemSchema,
  stockAdjustmentSchema,
} from "@/lib/validators/phase1";

describe("Phase 1 Engines & Validators", () => {
  it("computes intra-state CGST + SGST dynamically when state codes match", () => {
    const res = computeGstSplit("7500.00", "5.00", "33", "33");
    expect(res.isIntraState).toBe(true);
    expect(res.taxableAmount.toFixed(2)).toBe("7500.00");
    expect(res.cgstAmount.toFixed(2)).toBe("187.50");
    expect(res.sgstAmount.toFixed(2)).toBe("187.50");
    expect(res.igstAmount.toFixed(2)).toBe("0.00");
    expect(res.totalAmount.toFixed(2)).toBe("7875.00");
  });

  it("computes inter-state IGST dynamically for any differing state codes", () => {
    const res = computeGstSplit("6000.00", "5.00", "33", "29");
    expect(res.isIntraState).toBe(false);
    expect(res.cgstAmount.toFixed(2)).toBe("0.00");
    expect(res.sgstAmount.toFixed(2)).toBe("0.00");
    expect(res.igstAmount.toFixed(2)).toBe("300.00");
    expect(res.totalAmount.toFixed(2)).toBe("6300.00");
  });

  it("splits odd-paisa GST into CGST + SGST without 1-paisa drift", () => {
    // 100.00 * 5% = 5.00 -> 2.50 + 2.50
    // 100.20 * 5% = 5.01 -> 2.51 + 2.50 = 5.01
    const res = computeGstSplit("100.20", "5.00", "27", "27");
    expect(res.totalTax.toFixed(2)).toBe("5.01");
    expect(res.cgstAmount.plus(res.sgstAmount).toFixed(2)).toBe("5.01");
    expect(res.totalAmount.toFixed(2)).toBe("105.21");
  });

  it("converts purchase input units to base stock units and computes unit rate accurately", () => {
    // Buying 500 GRAM at ₹0.09/g = ₹45.00 -> converts to 0.500 KG @ ₹90.00/KG
    const baseQty = convertUnit(500, UnitType.GRAM, UnitType.KG);
    expect(baseQty.toFixed(3)).toBe("0.500");
    const lineTaxable = money(500 * 0.09);
    const baseRate = money(lineTaxable.div(baseQty));
    expect(baseRate.toFixed(2)).toBe("90.00");
  });

  it("validates CompanySettings GSTIN and stateCode", () => {
    const valid = companySettingsSchema.safeParse({
      companyName: "Test Foods Pvt Ltd",
      gstin: "33AABCN1234F1Z5",
      state: "Tamil Nadu",
      stateCode: "33",
      address: "10 Industrial Estate",
      phone: "9876543210",
      bankDetails: "Bank A/C 12345",
      defaultTolerancePercent: 3,
    });
    expect(valid.success).toBe(true);

    const badGstin = companySettingsSchema.safeParse({
      companyName: "Test Foods",
      gstin: "INVALID",
      state: "Tamil Nadu",
      stateCode: "33",
      address: "10 Industrial Estate",
      defaultTolerancePercent: 3,
    });
    expect(badGstin.success).toBe(false);
  });

  it("enforces mandatory audit reason on stock adjustments", () => {
    const missingReason = stockAdjustmentSchema.safeParse({
      itemId: "00000000-0000-4000-8000-000000000001",
      direction: "DECREASE",
      quantity: 2,
      reason: "bad",
    });
    expect(missingReason.success).toBe(false);

    const validAdj = stockAdjustmentSchema.safeParse({
      itemId: "00000000-0000-4000-8000-000000000001",
      direction: "DECREASE",
      quantity: 2,
      reason: "Damaged oil tin found during weekly audit",
    });
    expect(validAdj.success).toBe(true);
  });

  it("validates Item, Customer, and Purchase payloads", () => {
    expect(
      itemSchema.safeParse({
        code: "RAW-01",
        name: "Gram Flour",
        category: ItemCategory.RAW_MATERIAL,
        unit: UnitType.KG,
        hsnCode: "1106",
        taxRate: 5,
        reorderLevel: 25,
      }).success
    ).toBe(true);

    expect(
      customerSchema.safeParse({
        name: "Retailer X",
        type: CustomerType.RETAILER,
        state: "Karnataka",
        stateCode: "29",
        phone: "9876543210",
        address: "MG Road, Bengaluru",
        creditLimit: 50000,
        creditDays: 30,
      }).success
    ).toBe(true);

    expect(
      createPurchaseSchema.safeParse({
        supplierId: "00000000-0000-4000-8000-000000000001",
        billNumber: "BILL-101",
        purchaseDate: "2026-11-25",
        lines: [
          {
            itemId: "00000000-0000-4000-8000-000000000002",
            quantity: 60,
            inputUnit: UnitType.KG,
            unitRatePerInputUnit: 45,
            taxRate: 5,
          },
        ],
      }).success
    ).toBe(true);
  });
});
