"use server";
import { toSafeErrorMessage } from "@/lib/errors";

import { revalidatePath } from "next/cache";
import { DocumentType, ItemCategory, OrderStatus, Role } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { money } from "@/lib/decimal";
import { writeAuditLog } from "@/lib/engines/audit";
import { getNextDocumentNumber } from "@/lib/engines/sequence";
import { prisma } from "@/lib/prisma";
import { convertUnit } from "@/lib/units";
import {
  cancelFieldOrderSchema,
  createFieldOrderSchema,
} from "@/lib/validators/phase3";
import type { ActionResult } from "./masters.actions";

export async function submitFieldOrderAction(
  input: unknown
): Promise<ActionResult<{ orderId: string; orderNumber: string; deduplicated: boolean }>> {
  try {
    const actor = await requireVerifiedUser([Role.SALESMAN]);
    const parsed = createFieldOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid order details",
      };
    }

    const v = parsed.data;

    // Idempotency check for offline PWA sync retries
    if (v.clientRequestId) {
      const existing = await prisma.order.findUnique({
        where: { clientRequestId: v.clientRequestId },
        select: { id: true, orderNumber: true, salesmanId: true },
      });
      if (existing) {
        if (existing.salesmanId !== actor.id) {
          return { ok: false, error: "Forbidden idempotency key." };
        }
        return {
          ok: true,
          data: {
            orderId: existing.id,
            orderNumber: existing.orderNumber,
            deduplicated: true,
          },
        };
      }
    }

    const itemIds = v.items.map((l) => l.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      return {
        ok: false,
        error: "Duplicate products found. Combine quantities into a single line.",
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: v.customerId },
      });

      if (!customer || !customer.active) {
        throw new Error("Selected customer is missing or inactive.");
      }

      // IDOR / Territory guard: salesman can order only for assigned or open-territory customers
      if (
        customer.assignedSalesmanId &&
        customer.assignedSalesmanId !== actor.id
      ) {
        throw new Error("You are not assigned to this customer.");
      }

      const [items, customPrices] = await Promise.all([
        tx.item.findMany({
          where: {
            id: { in: itemIds },
            active: true,
            category: ItemCategory.FINISHED_GOOD,
          },
        }),
        tx.customerPrice.findMany({
          where: {
            customerId: customer.id,
            itemId: { in: itemIds },
            active: true,
          },
        }),
      ]);

      const itemMap = new Map(items.map((i) => [i.id, i]));
      const customPriceMap = new Map(
        customPrices.map((cp) => [cp.itemId, money(cp.customPrice.toString())])
      );

      let orderTaxableTotal = money(0);

      const preparedLines = v.items.map((line) => {
        const item = itemMap.get(line.itemId);
        if (!item) {
          throw new Error("One or more selected products are unavailable.");
        }

        const baseQty = convertUnit(line.quantity, line.inputUnit, item.unit, {
          unitsPerCarton: item.unitsPerCarton,
        });

        const resolvedPrice =
          customPriceMap.get(item.id) ??
          (item.sellingPrice ? money(item.sellingPrice.toString()) : null);

        if (!resolvedPrice || resolvedPrice.lte(0)) {
          throw new Error(`Selling price is not configured for ${item.name}.`);
        }

        const lineTotal = money(baseQty.mul(resolvedPrice));
        orderTaxableTotal = money(orderTaxableTotal.plus(lineTotal));

        return {
          itemId: item.id,
          quantity: baseQty,
          unitPrice: resolvedPrice,
          totalAmount: lineTotal,
        };
      });

      const orderNumber = await getNextDocumentNumber(tx, DocumentType.ORDER);

      const created = await tx.order.create({
        data: {
          orderNumber,
          clientRequestId: v.clientRequestId || null,
          salesmanId: actor.id,
          customerId: customer.id,
          status: OrderStatus.SUBMITTED,
          totalAmount: orderTaxableTotal,
          notes: v.notes || null,
          items: {
            create: preparedLines,
          },
        },
      });

      await writeAuditLog(tx, {
        entityType: "ORDER",
        entityId: created.id,
        action: "CREATE",
        userId: actor.id,
        changes: {
          orderNumber,
          customerName: customer.name,
          totalAmount: orderTaxableTotal.toFixed(2),
          lineCount: preparedLines.length,
        },
      });

      return {
        orderId: created.id,
        orderNumber: created.orderNumber,
        deduplicated: false,
      };
    });

    revalidatePath("/salesman");
    revalidatePath("/salesman/orders");
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to submit order"),
    };
  }
}

export async function cancelFieldOrderAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.SALESMAN]);
    const parsed = cancelFieldOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid cancellation request",
      };
    }

    const { orderId, reason } = parsed.data;
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found.");
      if (order.salesmanId !== actor.id) {
        throw new Error("You can only cancel your own orders.");
      }
      if (order.status !== OrderStatus.SUBMITTED) {
        throw new Error("Only submitted orders pending admin review can be cancelled.");
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          rejectionReason: reason,
        },
      });

      await writeAuditLog(tx, {
        entityType: "ORDER",
        entityId: order.id,
        action: "CANCEL",
        userId: actor.id,
        reason,
      });
    });

    revalidatePath("/salesman");
    revalidatePath("/salesman/orders");
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to cancel order"),
    };
  }
}
