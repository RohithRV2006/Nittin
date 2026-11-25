import { describe, expect, it } from "vitest";
import { UnitType } from "@prisma/client";
import { money, moneyStr, percent, qty } from "@/lib/decimal";
import { formatDisplayQty, isIntegerUnit } from "@/lib/enums";
import { computePackScaleFactor, convertUnit } from "@/lib/units";
import { getFinancialYear, sanitizeSpreadsheetCell } from "@/lib/security";
import { canAccessPath } from "@/lib/roles";
import { formatPdfRs } from "@/lib/pdf/invoice-pdf";

describe("Core ERP Foundation Utilities", () => {
  it("avoids floating point drift in money and percentage rounding", () => {
    // 0.1 + 0.2 should equal 0.30 exactly
    const sum = money("0.1").add(money("0.2"));
    expect(moneyStr(sum)).toBe("0.30");

    // 5810 / 188 = 30.904255... -> 30.90 ROUND_HALF_UP
    const costPerPkt = money(money("5810").div("188"));
    expect(moneyStr(costPerPkt)).toBe("30.90");

    // (188 - 200) / 200 * 100 = -6.00%
    const yieldVar = percent(
      qty("188").minus("200").div("200").mul("100")
    );
    expect(yieldVar.toFixed(2)).toBe("-6.00");
  });

  it("converts physical and packaging units deterministically", () => {
    expect(convertUnit(500, UnitType.GRAM, UnitType.KG).toFixed(3)).toBe("0.500");
    expect(convertUnit(1.2, UnitType.KG, UnitType.GRAM).toFixed(3)).toBe("1200.000");
    expect(convertUnit(250, UnitType.ML, UnitType.LITRE).toFixed(3)).toBe("0.250");
    expect(
      convertUnit(9, UnitType.CARTON, UnitType.PACKET, { unitsPerCarton: 20 }).toFixed(3)
    ).toBe("180.000");
    expect(computePackScaleFactor(200, 500).toFixed(3)).toBe("2.500");
  });

  it("neutralizes spreadsheet formula injection (CWE-1236)", () => {
    expect(sanitizeSpreadsheetCell("=CMD|'/C calc'!A0")).toBe("'=CMD|'/C calc'!A0");
    expect(sanitizeSpreadsheetCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(sanitizeSpreadsheetCell("Retailer A")).toBe("Retailer A");
  });

  it("computes Indian financial year cleanly across April boundary", () => {
    expect(getFinancialYear(new Date("2026-03-31T00:00:00Z"))).toBe("2025-26");
    expect(getFinancialYear(new Date("2026-04-01T00:00:00Z"))).toBe("2026-27");
  });

  it("enforces strict 1-role-per-portal route access boundaries", () => {
    expect(canAccessPath("SALESMAN", "/salesman/new-order")).toBe(true);
    expect(canAccessPath("SALESMAN", "/admin/orders")).toBe(false);
    expect(canAccessPath("FACTORY_ADMIN", "/admin/orders")).toBe(true);
    expect(canAccessPath("FACTORY_ADMIN", "/production")).toBe(false);
    expect(canAccessPath("FACTORY_ADMIN", "/auditor")).toBe(false);
    expect(canAccessPath("FACTORY_ADMIN", "/dashboard")).toBe(false);
    expect(canAccessPath("OWNER", "/dashboard")).toBe(true);
    expect(canAccessPath("OWNER", "/auditor")).toBe(false);
    expect(canAccessPath("AUDITOR", "/auditor/stock-ledger")).toBe(true);
    expect(canAccessPath("AUDITOR", "/admin/masters")).toBe(false);
    expect(canAccessPath("PRODUCTION_SUPERVISOR", "/production/new-run")).toBe(true);
    expect(canAccessPath("PRODUCTION_SUPERVISOR", "/dashboard")).toBe(false);
  });

  it("formats discrete units as whole numbers and PDF amounts without Unicode rupee glyph", () => {
    expect(isIntegerUnit("PIECE")).toBe(true);
    expect(isIntegerUnit("PACKET")).toBe(true);
    expect(isIntegerUnit("CARTON")).toBe(true);
    expect(isIntegerUnit("KG")).toBe(false);
    expect(formatDisplayQty("150.000", "PACKET")).toBe("150");
    expect(formatDisplayQty("12.500", "KG")).toBe("12.500");

    const pdfAmt = formatPdfRs("7500.00");
    expect(pdfAmt).toBe("Rs. 7,500.00");
    expect(pdfAmt).not.toContain("₹");
  });
});
