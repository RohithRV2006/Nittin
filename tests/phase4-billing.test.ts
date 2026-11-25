import { describe, expect, it } from "vitest";
import { PaymentMode } from "@prisma/client";
import { generateMockNicDocuments } from "@/lib/engines/einvoice";
import {
  approveOrderSchema,
  cancelInvoiceSchema,
  recordCustomerPaymentSchema,
  rejectOrderSchema,
} from "@/lib/validators/phase4";

describe("Phase 4 Billing, e-Invoice & Payment Engines", () => {
  it("generates deterministic NIC v1.1 e-Invoice & e-Way Bill JSON payloads", () => {
    const res = generateMockNicDocuments({
      invoiceNumber: "INV/2026-27/0001",
      invoiceDateIso: "2026-11-25T00:00:00.000Z",
      financialYear: "2026-27",
      seller: {
        gstin: "33AABCN1234F1Z5",
        legalName: "Sample Foods Pvt Ltd",
        address: "SIDCO Estate",
        state: "Tamil Nadu",
        stateCode: "33",
      },
      buyer: {
        gstin: "33AAACR1111A1Z1",
        legalName: "Retailer A",
        address: "Bazaar Road",
        state: "Tamil Nadu",
        stateCode: "33",
      },
      taxableAmount: "7500.00",
      cgstAmount: "187.50",
      sgstAmount: "187.50",
      igstAmount: "0.00",
      totalAmount: "7875.00",
      items: [
        {
          slNo: 1,
          itemName: "Murukku 200 g",
          hsnCode: "1905",
          qty: "150.000",
          unit: "PACKET",
          unitPrice: "50.00",
          taxableAmount: "7500.00",
          taxRate: "5.00",
          cgstAmount: "187.50",
          sgstAmount: "187.50",
          igstAmount: "0.00",
          totalAmount: "7875.00",
        },
      ],
    });

    expect(res.irn).toHaveLength(64);
    expect(res.eInvoiceJson.Version).toBe("1.1");
    expect(res.eInvoiceJson.TranDtls.SupTyp).toBe("B2B");
    expect(res.eInvoiceJson.ValDtls.TotInvVal).toBe(7875);
    expect(res.eWayBillJson.transactionType).toBe(1); // Intra-state
    expect(res.eWayBillJson.cgstValue).toBe(187.5);
  });

  it("marks inter-state e-Way Bill transactionType=2 and IGST rates", () => {
    const res = generateMockNicDocuments({
      invoiceNumber: "INV/2026-27/0002",
      invoiceDateIso: "2026-11-25T00:00:00.000Z",
      financialYear: "2026-27",
      seller: {
        gstin: "33AABCN1234F1Z5",
        legalName: "Sample Foods Pvt Ltd",
        address: "SIDCO Estate",
        state: "Tamil Nadu",
        stateCode: "33",
      },
      buyer: {
        gstin: "29AAACD2222B1Z9",
        legalName: "Distributor B",
        address: "APMC Yard",
        state: "Karnataka",
        stateCode: "29",
      },
      taxableAmount: "6000.00",
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: "300.00",
      totalAmount: "6300.00",
      items: [
        {
          slNo: 1,
          itemName: "Murukku 200 g",
          hsnCode: "1905",
          qty: "120.000",
          unit: "PACKET",
          unitPrice: "50.00",
          taxableAmount: "6000.00",
          taxRate: "5.00",
          cgstAmount: "0.00",
          sgstAmount: "0.00",
          igstAmount: "300.00",
          totalAmount: "6300.00",
        },
      ],
    });

    expect(res.eWayBillJson.transactionType).toBe(2);
    expect(res.eWayBillJson.itemList[0]?.igstRate).toBe(5);
    expect(res.eWayBillJson.igstValue).toBe(300);
  });

  it("validates Phase 4 approval, rejection, credit note, and payment schemas", () => {
    expect(
      approveOrderSchema.safeParse({
        orderId: "00000000-0000-4000-8000-000000000001",
        items: [
          {
            orderItemId: "00000000-0000-4000-8000-000000000002",
            quantity: 150,
            unitPrice: 50,
          },
        ],
      }).success
    ).toBe(true);

    expect(
      cancelInvoiceSchema.safeParse({
        invoiceId: "00000000-0000-4000-8000-000000000001",
        reason: "no",
      }).success
    ).toBe(false);

    expect(
      rejectOrderSchema.safeParse({
        orderId: "00000000-0000-4000-8000-000000000001",
        reason: "Customer credit limit exceeded",
      }).success
    ).toBe(true);

    expect(
      recordCustomerPaymentSchema.safeParse({
        customerId: "00000000-0000-4000-8000-000000000001",
        amount: 4000,
        paymentMode: PaymentMode.UPI,
        paymentDate: "2026-11-25",
        referenceNumber: "UTR123456",
      }).success
    ).toBe(true);
  });
});
