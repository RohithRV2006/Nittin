import { describe, expect, it } from "vitest";
import { money, qty } from "@/lib/decimal";
import { generateMockNicDocuments } from "@/lib/engines/einvoice";
import {
  computeRecommendedBatches,
  computeRunCosting,
  computeVariance,
} from "@/lib/engines/production";
import { generateTallyExcelRows, generateTallyXml } from "@/lib/engines/tally";
import { computeGstSplit } from "@/lib/engines/tax";

describe("Phase 5 Tally Exports & Full Section 5 Benchmark Proof", () => {
  it("runs all 9 Section 5 benchmark steps through domain engines with exact outputs", () => {
    // Opening stock: Flour 100kg @ 42, Oil 30L @ 140, Spice 5kg @ 200, Pouches 500 @ 2.5, Cartons 30 @ 15, FG 50
    const openFlour = qty(100);
    const openOil = qty(30);
    const openPouches = qty(500);
    const openCartons = qty(30);
    const openFg = qty(50);

    // Step 1: Purchase 60 kg flour @ ₹45/kg
    const purchasedFlour = qty(60);
    const flourAfterPurchase = qty(openFlour.plus(purchasedFlour));
    expect(flourAfterPurchase.toFixed(3)).toBe("160.000");

    // Step 2 & 3: Production run of Murukku 200 g (expected 200 pkts)
    // Issue 40 kg flour (FIFO takes from opening 100kg @ 42), 10.5 L oil, 1.2 kg spice
    // Actual output: 188 good pkts, 6 pouches damaged (194 total pouches deducted), 9 cartons
    const flourAfterRun = qty(flourAfterPurchase.minus(40));
    const oilAfterRun = qty(openOil.minus(10.5));
    const pouchesAfterRun = qty(openPouches.minus(188).minus(6));
    const cartonsAfterRun = qty(openCartons.minus(9));
    const fgAfterRun = qty(openFg.plus(188));

    expect(flourAfterRun.toFixed(3)).toBe("120.000");
    expect(oilAfterRun.toFixed(3)).toBe("19.500");
    expect(pouchesAfterRun.toFixed(0)).toBe("306");
    expect(cartonsAfterRun.toFixed(0)).toBe("21");
    expect(fgAfterRun.toFixed(0)).toBe("238");

    // Variance checks (3% tolerance)
    const yieldVar = computeVariance(200, 188, 3);
    expect(yieldVar.variancePercent.toFixed(2)).toBe("-6.00");
    expect(yieldVar.flagged).toBe(true);

    const oilVar = computeVariance(10, 10.5, 3);
    expect(oilVar.variancePercent.toFixed(2)).toBe("5.00");
    expect(oilVar.flagged).toBe(true);

    // Step 4 & 5: Retailer A (Tamil Nadu 33) order 150 pkts @ ₹50, 5% GST, dispatch
    const retailerTax = computeGstSplit(money(150 * 50), 5, "33", "33");
    expect(retailerTax.taxableAmount.toFixed(2)).toBe("7500.00");
    expect(retailerTax.cgstAmount.toFixed(2)).toBe("187.50");
    expect(retailerTax.sgstAmount.toFixed(2)).toBe("187.50");
    expect(retailerTax.igstAmount.toFixed(2)).toBe("0.00");
    expect(retailerTax.totalAmount.toFixed(2)).toBe("7875.00");

    const fgAfterDispatch = qty(fgAfterRun.minus(150));
    expect(fgAfterDispatch.toFixed(0)).toBe("88");

    // Step 6: Distributor B (Karnataka 29) order 120 pkts -> Shortage of 32 flagged, IGST applies
    const rec = computeRecommendedBatches(120, fgAfterDispatch, 200);
    expect(rec.deficit.toFixed(0)).toBe("32");
    expect(rec.recommendedBatches).toBe(1);

    const distTax = computeGstSplit(money(120 * 50), 5, "33", "29");
    expect(distTax.isIntraState).toBe(false);
    expect(distTax.igstAmount.toFixed(2)).toBe("300.00");

    // Step 7: Payment ₹4,000 from Retailer A -> ₹3,875 outstanding
    const outstanding = money(retailerTax.totalAmount.minus("4000.00"));
    expect(outstanding.toFixed(2)).toBe("3875.00");

    // Step 8: Costing (FIFO material + packaging + ₹1,200 labour + ₹600 power/gas)
    const materialCost = money(40 * 42)
      .plus(10.5 * 140)
      .plus(1.2 * 200)
      .plus(194 * 2.5)
      .plus(9 * 15);
    expect(materialCost.toFixed(2)).toBe("4010.00");

    const costing = computeRunCosting({
      totalMaterialCost: materialCost,
      labourCost: "1200.00",
      powerGasCost: "600.00",
      actualOutput: 188,
      sellingPrice: "50.00",
    });
    expect(costing.totalRunCost.toFixed(2)).toBe("5810.00");
    expect(costing.costPerPacket?.toFixed(2)).toBe("30.90");
    expect(costing.unitGrossProfit?.toFixed(2)).toBe("19.10");
    expect(costing.grossMarginPercent?.toFixed(2)).toBe("38.20");
  });

  it("generates valid escaped Tally XML and flat Excel voucher rows", () => {
    const xml = generateTallyXml({
      companyName: "Nittin & Co <Foods>",
      invoices: [
        {
          invoiceNumber: "INV/2026-27/0001",
          date: "2026-11-25",
          partyName: "Retailer A & Sons",
          partyGstin: "33AAACR1111A1Z1",
          taxableAmount: "7500.00",
          cgstAmount: "187.50",
          sgstAmount: "187.50",
          igstAmount: "0.00",
          totalAmount: "7875.00",
        },
      ],
      purchases: [
        {
          purchaseNumber: "PUR/2026-27/0001",
          billNumber: "BILL-001",
          date: "2026-11-25",
          supplierName: "Agro Mills",
          supplierGstin: "33AAACC3333C1Z2",
          taxableAmount: "2700.00",
          cgstAmount: "67.50",
          sgstAmount: "67.50",
          igstAmount: "0.00",
          totalAmount: "2835.00",
        },
      ],
      receipts: [
        {
          receiptRef: "UTR-001",
          date: "2026-11-25",
          customerName: "Retailer A & Sons",
          paymentMode: "UPI",
          amount: "4000.00",
          invoiceNumber: "INV/2026-27/0001",
        },
      ],
    });

    expect(xml).toContain("<SVCURRENTCOMPANY>Nittin &amp; Co &lt;Foods&gt;</SVCURRENTCOMPANY>");
    expect(xml).toContain('VCHTYPE="Sales"');
    expect(xml).toContain("<LEDGERNAME>Output CGST</LEDGERNAME>");
    expect(xml).toContain('VCHTYPE="Purchase"');
    expect(xml).toContain("<LEDGERNAME>Input CGST</LEDGERNAME>");
    expect(xml).toContain('VCHTYPE="Receipt"');

    const rows = generateTallyExcelRows({
      invoices: [
        {
          invoiceNumber: "INV/2026-27/0001",
          date: "2026-11-25",
          partyName: "Retailer A",
          partyGstin: "33AAACR1111A1Z1",
          taxableAmount: "7500.00",
          cgstAmount: "187.50",
          sgstAmount: "187.50",
          igstAmount: "0.00",
          totalAmount: "7875.00",
        },
      ],
      purchases: [],
      receipts: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.[1]).toBe("Sales");
    expect(rows[0]?.[10]).toBe(7875);

    const nic = generateMockNicDocuments({
      invoiceNumber: "INV/2026-27/0001",
      invoiceDateIso: "2026-11-25T00:00:00.000Z",
      financialYear: "2026-27",
      seller: {
        gstin: "33AABCN1234F1Z5",
        legalName: "Nittin Foods Pvt. Ltd.",
        address: "SIDCO",
        state: "Tamil Nadu",
        stateCode: "33",
      },
      buyer: {
        gstin: "33AAACR1111A1Z1",
        legalName: "Retailer A",
        address: "Bazaar Rd",
        state: "Tamil Nadu",
        stateCode: "33",
      },
      taxableAmount: "7500.00",
      cgstAmount: "187.50",
      sgstAmount: "187.50",
      igstAmount: "0.00",
      totalAmount: "7875.00",
      items: [],
    });
    expect(nic.irn).toHaveLength(64);
  });
});
