import { describe, expect, it } from "vitest";
import { UnitType } from "@prisma/client";
import { computeGstSplit } from "@/lib/engines/tax";
import { convertUnit } from "@/lib/units";
import { money } from "@/lib/decimal";
import {
  cancelFieldOrderSchema,
  createFieldOrderSchema,
} from "@/lib/validators/phase3";

describe("Phase 3 Salesman Order & Offline Validators", () => {
  it("validates field order payloads with clientRequestId idempotency key", () => {
    const valid = createFieldOrderSchema.safeParse({
      clientRequestId: "00000000-0000-4000-8000-000000000099",
      customerId: "00000000-0000-4000-8000-000000000001",
      notes: "Deliver before 5 PM",
      items: [
        {
          itemId: "00000000-0000-4000-8000-000000000002",
          quantity: 150,
          inputUnit: UnitType.PACKET,
        },
      ],
    });
    expect(valid.success).toBe(true);

    const emptyItems = createFieldOrderSchema.safeParse({
      customerId: "00000000-0000-4000-8000-000000000001",
      items: [],
    });
    expect(emptyItems.success).toBe(false);

    const badQty = createFieldOrderSchema.safeParse({
      customerId: "00000000-0000-4000-8000-000000000001",
      items: [
        {
          itemId: "00000000-0000-4000-8000-000000000002",
          quantity: 0,
          inputUnit: UnitType.PACKET,
        },
      ],
    });
    expect(badQty.success).toBe(false);
  });

  it("computes carton-to-packet order line totals and GST preview accurately", () => {
    // 6 cartons * 20 pkts/carton = 120 pkts * ₹50 = ₹6,000 -> 5% IGST = ₹300 -> ₹6,300
    const basePackets = convertUnit(6, "CARTON", "PACKET", {
      unitsPerCarton: 20,
    });
    expect(basePackets.toFixed(0)).toBe("120");

    const lineTaxable = money(basePackets.mul("50.00"));
    const split = computeGstSplit(lineTaxable, "5.00", "33", "29");
    expect(split.taxableAmount.toFixed(2)).toBe("6000.00");
    expect(split.igstAmount.toFixed(2)).toBe("300.00");
    expect(split.totalAmount.toFixed(2)).toBe("6300.00");
  });

  it("validates salesman order cancellation schema", () => {
    expect(
      cancelFieldOrderSchema.safeParse({
        orderId: "00000000-0000-4000-8000-000000000001",
        reason: "Retailer postponed order",
      }).success
    ).toBe(true);

    expect(
      cancelFieldOrderSchema.safeParse({
        orderId: "00000000-0000-4000-8000-000000000001",
        reason: "no",
      }).success
    ).toBe(false);
  });
});
