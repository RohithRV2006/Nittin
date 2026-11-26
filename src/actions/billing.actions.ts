"use server";
import { toSafeErrorMessage } from "@/lib/errors";

import { revalidatePath } from "next/cache";
import {
  CreditNoteType,
  DispatchStatus,
  DocumentType,
  InvoiceStatus,
  MovementType,
  OrderStatus,
  PaymentStatus,
  RefType,
  ReturnCondition,
  Role,
} from "@prisma/client";
import Decimal from "decimal.js";
import { requireVerifiedUser } from "@/lib/auth";
import { money, qty, toDec } from "@/lib/decimal";
import { writeAuditLog } from "@/lib/engines/audit";
import { generateMockNicDocuments } from "@/lib/engines/einvoice";
import { getNextDocumentNumber } from "@/lib/engines/sequence";
import {
  consumeFifoBatches,
  getItemStockMap,
  recordInwardBatchAndLedger,
} from "@/lib/engines/stock";
import { computeGstSplit } from "@/lib/engines/tax";
import { isIntegerUnit } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { getFinancialYear } from "@/lib/security";
import {
  approveOrderSchema,
  cancelInvoiceSchema,
  dispatchInvoiceSchema,
  holdOrderSchema,
  recordCustomerPaymentSchema,
  recordSalesReturnSchema,
  rejectOrderSchema,
} from "@/lib/validators/phase4";
import type { ActionResult } from "./masters.actions";

export async function approveAndInvoiceOrderAction(
  input: unknown
): Promise<ActionResult<{ invoiceNumber: string; invoiceId: string }>> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = approveOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid approval" };
    }

    const v = parsed.data;
    const res = await prisma.$transaction(async (tx) => {
      const settings = await tx.companySettings.findUnique({
        where: { id: "default" },
      });
      if (!settings?.isConfigured || !settings.stateCode || !settings.gstin) {
        throw new Error(
          "Configure factory GSTIN and state code under Masters before raising GST invoices."
        );
      }

      const order = await tx.order.findUnique({
        where: { id: v.orderId },
        include: {
          customer: true,
          items: { include: { item: true } },
          invoice: true,
        },
      });
      if (!order) throw new Error("Order not found.");
      if (order.invoice) throw new Error("An invoice has already been generated for this order.");
      if (
        order.status !== OrderStatus.SUBMITTED &&
        order.status !== OrderStatus.APPROVED &&
        order.status !== OrderStatus.ON_HOLD
      ) {
        throw new Error(`Order in status ${order.status} cannot be invoiced.`);
      }

      const overrideMap = new Map(v.items.map((i) => [i.orderItemId, i]));
      const stockMap = await getItemStockMap(
        tx,
        order.items.map((oi) => oi.itemId)
      );

      let orderEdited = false;
      const beforeItems: Array<{ id: string; quantity: string; unitPrice: string }> = [];
      const afterItems: Array<{ id: string; quantity: string; unitPrice: string }> = [];

      let totalTaxable = money(0);
      let totalCgst = money(0);
      let totalSgst = money(0);
      let totalIgst = money(0);

      const preparedInvoiceLines: Array<{
        itemId: string;
        hsnCode: string;
        quantity: Decimal;
        unitPrice: Decimal;
        taxRate: Decimal;
        taxableAmount: Decimal;
        cgstAmount: Decimal;
        sgstAmount: Decimal;
        igstAmount: Decimal;
        totalAmount: Decimal;
      }> = [];

      for (const oi of order.items) {
        const override = overrideMap.get(oi.id);
        const finalQty = qty(override ? override.quantity : oi.quantity.toString());
        const finalPrice = money(
          override ? override.unitPrice : oi.unitPrice.toString()
        );

        const avail = stockMap.get(oi.itemId) ?? qty(0);
        if (avail.lt(finalQty)) {
          const deficit = qty(finalQty.minus(avail));
          throw new Error(
            `Insufficient stock for ${oi.item.name}: ordered ${finalQty.toFixed(0)} vs ${avail.toFixed(0)} available (Shortage of ${deficit.toFixed(0)} ${oi.item.unit}). Place order On Hold or adjust quantity.`
          );
        }

        const origQty = qty(oi.quantity.toString());
        const origPrice = money(oi.unitPrice.toString());
        if (!finalQty.eq(origQty) || !finalPrice.eq(origPrice)) {
          orderEdited = true;
          beforeItems.push({
            id: oi.id,
            quantity: origQty.toFixed(3),
            unitPrice: origPrice.toFixed(2),
          });
          afterItems.push({
            id: oi.id,
            quantity: finalQty.toFixed(3),
            unitPrice: finalPrice.toFixed(2),
          });
          await tx.orderItem.update({
            where: { id: oi.id },
            data: {
              quantity: finalQty,
              unitPrice: finalPrice,
              totalAmount: money(finalQty.mul(finalPrice)),
            },
          });
        }

        const lineTaxable = money(finalQty.mul(finalPrice));
        const split = computeGstSplit(
          lineTaxable,
          oi.item.taxRate.toString(),
          settings.stateCode,
          order.customer.stateCode
        );

        totalTaxable = money(totalTaxable.plus(split.taxableAmount));
        totalCgst = money(totalCgst.plus(split.cgstAmount));
        totalSgst = money(totalSgst.plus(split.sgstAmount));
        totalIgst = money(totalIgst.plus(split.igstAmount));

        preparedInvoiceLines.push({
          itemId: oi.itemId,
          hsnCode: oi.item.hsnCode,
          quantity: finalQty,
          unitPrice: finalPrice,
          taxRate: toDec(oi.item.taxRate.toString()).toDecimalPlaces(2),
          taxableAmount: split.taxableAmount,
          cgstAmount: split.cgstAmount,
          sgstAmount: split.sgstAmount,
          igstAmount: split.igstAmount,
          totalAmount: split.totalAmount,
        });
      }

      const invoiceDate = new Date();
      const dueDate = new Date(
        invoiceDate.getTime() + order.customer.creditDays * 24 * 60 * 60 * 1000
      );
      const invoiceNumber = await getNextDocumentNumber(
        tx,
        DocumentType.INVOICE,
        invoiceDate
      );
      const grandTotal = money(
        totalTaxable.plus(totalCgst).plus(totalSgst).plus(totalIgst)
      );

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          customerId: order.customerId,
          createdById: actor.id,
          invoiceDate,
          dueDate,
          placeOfSupply: order.customer.state,
          placeOfSupplyCode: order.customer.stateCode,
          taxableAmount: totalTaxable,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          totalAmount: grandTotal,
          status: InvoiceStatus.POSTED,
          dispatchStatus: DispatchStatus.PENDING_DISPATCH,
          paymentStatus: PaymentStatus.UNPAID,
          items: { create: preparedInvoiceLines },
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.INVOICED,
          totalAmount: totalTaxable,
        },
      });

      if (orderEdited) {
        await writeAuditLog(tx, {
          entityType: "ORDER",
          entityId: order.id,
          action: "UPDATE",
          userId: actor.id,
          changes: { before: beforeItems, after: afterItems },
          reason: "Admin adjusted order quantities/prices during verification",
        });
      }

      await writeAuditLog(tx, {
        entityType: "INVOICE",
        entityId: invoice.id,
        action: "CREATE",
        userId: actor.id,
        changes: {
          invoiceNumber,
          orderNumber: order.orderNumber,
          totalAmount: grandTotal.toFixed(2),
        },
      });

      return { invoiceNumber, invoiceId: invoice.id };
    });

    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/invoices");
    revalidatePath("/salesman");
    revalidatePath("/salesman/orders");
    return { ok: true, data: res };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to generate GST invoice"),
    };
  }
}

export async function holdOrderAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = holdOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid request" };
    }

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: parsed.data.orderId } });
      if (!order) throw new Error("Order not found.");
      if (order.status !== OrderStatus.SUBMITTED && order.status !== OrderStatus.APPROVED) {
        throw new Error("Only pending orders can be placed on hold.");
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.ON_HOLD },
      });

      await writeAuditLog(tx, {
        entityType: "ORDER",
        entityId: order.id,
        action: "UPDATE",
        userId: actor.id,
        changes: { status: OrderStatus.ON_HOLD },
        reason: parsed.data.notes || "Placed on hold due to insufficient finished stock",
      });
    });

    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/production");
    revalidatePath("/salesman");
    revalidatePath("/salesman/orders");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeErrorMessage(err, "Action failed") };
  }
}

export async function rejectOrderAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = rejectOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reason" };
    }

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: parsed.data.orderId } });
      if (!order) throw new Error("Order not found.");
      if (order.status === OrderStatus.INVOICED || order.status === OrderStatus.DISPATCHED) {
        throw new Error("Invoiced orders must be cancelled via Credit Note.");
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REJECTED,
          rejectionReason: parsed.data.reason,
        },
      });

      await writeAuditLog(tx, {
        entityType: "ORDER",
        entityId: order.id,
        action: "REJECT",
        userId: actor.id,
        reason: parsed.data.reason,
      });
    });

    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/salesman");
    revalidatePath("/salesman/orders");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeErrorMessage(err, "Rejection failed") };
  }
}

export async function recordDispatchAction(
  input: unknown
): Promise<ActionResult<{ challanNumber: string; dispatchStatus: DispatchStatus }>> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = dispatchInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid dispatch payload",
      };
    }

    const v = parsed.data;
    const res = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: v.invoiceId },
        include: { items: { include: { item: true } } },
      });

      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.status !== InvoiceStatus.POSTED) {
        throw new Error("Cancelled invoices cannot be dispatched.");
      }
      if (invoice.dispatchStatus === DispatchStatus.DISPATCHED) {
        throw new Error("Invoice has already been completely dispatched.");
      }

      const itemById = new Map(invoice.items.map((li) => [li.id, li]));
      const dispatchLines: Array<{
        invoiceItemId: string;
        itemId: string;
        itemName: string;
        unit: typeof invoice.items[number]["item"]["unit"];
        dispatchQty: ReturnType<typeof qty>;
      }> = [];

      if (v.items && v.items.length > 0) {
        for (const reqLine of v.items) {
          const li = itemById.get(reqLine.invoiceItemId);
          if (!li) throw new Error("Invalid invoice line selected for dispatch.");
          const dQty = qty(reqLine.quantity);
          if (isIntegerUnit(li.item.unit) && !dQty.isInteger()) {
            throw new Error(
              `${li.item.name} uses ${li.item.unit} and must be dispatched in whole numbers.`
            );
          }
          const ordered = qty(li.quantity.toString());
          const already = qty(li.dispatchedQty.toString());
          const remaining = qty(ordered.minus(already));
          if (dQty.gt(remaining)) {
            throw new Error(
              `Dispatch qty (${dQty.toString()}) for ${li.item.name} exceeds remaining qty (${remaining.toString()}).`
            );
          }
          dispatchLines.push({
            invoiceItemId: li.id,
            itemId: li.itemId,
            itemName: li.item.name,
            unit: li.item.unit,
            dispatchQty: dQty,
          });
        }
      } else {
        for (const li of invoice.items) {
          const ordered = qty(li.quantity.toString());
          const already = qty(li.dispatchedQty.toString());
          const remaining = qty(ordered.minus(already));
          if (remaining.gt(0)) {
            dispatchLines.push({
              invoiceItemId: li.id,
              itemId: li.itemId,
              itemName: li.item.name,
              unit: li.item.unit,
              dispatchQty: remaining,
            });
          }
        }
      }

      if (dispatchLines.length === 0) {
        throw new Error("No remaining quantities left to dispatch.");
      }

      const challanNumber = await getNextDocumentNumber(
        tx,
        DocumentType.DISPATCH_CHALLAN
      );

      const challan = await tx.dispatchChallan.create({
        data: {
          challanNumber,
          invoiceId: invoice.id,
          dispatchedById: actor.id,
          vehicleNumber: v.vehicleNumber || null,
          notes: v.notes || null,
          items: {
            create: dispatchLines.map((dl) => ({
              invoiceItemId: dl.invoiceItemId,
              itemId: dl.itemId,
              quantity: dl.dispatchQty,
            })),
          },
        },
      });

      const updatedByLine = new Map<string, ReturnType<typeof qty>>();
      for (const dl of dispatchLines) {
        await consumeFifoBatches(tx, {
          itemId: dl.itemId,
          unit: dl.unit,
          requiredQty: dl.dispatchQty.toString(),
          movementType: MovementType.DISPATCH_SALE,
          referenceType: RefType.INVOICE,
          referenceId: invoice.id,
          createdById: actor.id,
          notes: `Challan ${challanNumber} for ${invoice.invoiceNumber}`,
          preferFefo: v.preferFefo,
        });

        const existingLi = itemById.get(dl.invoiceItemId)!;
        const nextDispatched = qty(
          qty(existingLi.dispatchedQty.toString()).plus(dl.dispatchQty)
        );
        updatedByLine.set(dl.invoiceItemId, nextDispatched);

        await tx.invoiceItem.update({
          where: { id: dl.invoiceItemId },
          data: { dispatchedQty: nextDispatched },
        });
      }

      const allComplete = invoice.items.every((li) => {
        const nextDispatched =
          updatedByLine.get(li.id) ?? qty(li.dispatchedQty.toString());
        return nextDispatched.gte(qty(li.quantity.toString()));
      });

      const nextStatus = allComplete
        ? DispatchStatus.DISPATCHED
        : DispatchStatus.PARTIALLY_DISPATCHED;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          dispatchStatus: nextStatus,
          dispatchedAt: new Date(),
          dispatchedById: actor.id,
        },
      });

      if (allComplete) {
        await tx.order.update({
          where: { id: invoice.orderId },
          data: { status: OrderStatus.DISPATCHED },
        });
      }

      await writeAuditLog(tx, {
        entityType: "INVOICE",
        entityId: invoice.id,
        action: "DISPATCH",
        userId: actor.id,
        changes: {
          invoiceNumber: invoice.invoiceNumber,
          challanId: challan.id,
          challanNumber,
          dispatchStatus: nextStatus,
        },
      });

      return { challanNumber, dispatchStatus: nextStatus };
    });

    revalidatePath("/admin");
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/adjustments");
    revalidatePath("/salesman");
    revalidatePath("/salesman/orders");
    return { ok: true, data: res };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to record dispatch"),
    };
  }
}

export async function recordSalesReturnAction(input: unknown): Promise<
  ActionResult<{
    creditNoteNumber: string;
    totalCredit: string;
    restockedQty: string;
  }>
> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = recordSalesReturnSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid sales return",
      };
    }

    const v = parsed.data;
    const res = await prisma.$transaction(async (tx) => {
      const [settings, invoice] = await Promise.all([
        tx.companySettings.findUnique({ where: { id: "default" } }),
        tx.invoice.findUnique({
          where: { id: v.invoiceId },
          include: {
            items: {
              include: {
                item: true,
                creditNoteItems: {
                  include: {
                    creditNote: { select: { type: true } },
                  },
                },
              },
            },
            creditNotes: { select: { amount: true } },
          },
        }),
      ]);

      if (!settings?.stateCode) {
        throw new Error("Configure Company Settings before recording sales returns.");
      }
      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.status !== InvoiceStatus.POSTED) {
        throw new Error("Sales returns are only allowed on posted invoices.");
      }
      if (invoice.dispatchStatus === DispatchStatus.PENDING_DISPATCH) {
        throw new Error("Invoice has not been dispatched yet; cancel invoice instead.");
      }

      const itemById = new Map(invoice.items.map((li) => [li.id, li]));

      let totalTaxable = money(0);
      let totalCgst = money(0);
      let totalSgst = money(0);
      let totalIgst = money(0);
      let restockedTotalQty = qty(0);

      const preparedLines: Array<{
        invoiceItemId: string;
        itemId: string;
        itemCode: string;
        itemName: string;
        unit: typeof invoice.items[number]["item"]["unit"];
        returnedQty: ReturnType<typeof qty>;
        condition: ReturnCondition;
        unitPrice: string;
        taxRate: string;
        taxableAmount: ReturnType<typeof money>;
        cgstAmount: ReturnType<typeof money>;
        sgstAmount: ReturnType<typeof money>;
        igstAmount: ReturnType<typeof money>;
        totalAmount: ReturnType<typeof money>;
      }> = [];

      for (const reqLine of v.items) {
        const li = itemById.get(reqLine.invoiceItemId);
        if (!li) throw new Error("Invalid invoice line selected for return.");
        const rQty = qty(reqLine.quantity);
        if (isIntegerUnit(li.item.unit) && !rQty.isInteger()) {
          throw new Error(
            `${li.item.name} uses ${li.item.unit} and must be returned in whole numbers.`
          );
        }

        let alreadyReturned = qty(0);
        for (const cni of li.creditNoteItems) {
          alreadyReturned = qty(alreadyReturned.plus(cni.returnedQty.toString()));
        }

        const dispatched = qty(li.dispatchedQty.toString());
        const maxReturnable = qty(dispatched.minus(alreadyReturned));
        if (rQty.gt(maxReturnable)) {
          throw new Error(
            `Return qty (${rQty.toString()}) for ${li.item.name} exceeds returnable dispatched qty (${maxReturnable.toString()}).`
          );
        }

        const lineTaxable = money(rQty.mul(li.unitPrice.toString()));
        const split = computeGstSplit(
          lineTaxable,
          li.taxRate.toString(),
          settings.stateCode,
          invoice.placeOfSupplyCode
        );

        totalTaxable = money(totalTaxable.plus(split.taxableAmount));
        totalCgst = money(totalCgst.plus(split.cgstAmount));
        totalSgst = money(totalSgst.plus(split.sgstAmount));
        totalIgst = money(totalIgst.plus(split.igstAmount));

        if (reqLine.condition === ReturnCondition.RESALEABLE) {
          restockedTotalQty = qty(restockedTotalQty.plus(rQty));
        }

        preparedLines.push({
          invoiceItemId: li.id,
          itemId: li.itemId,
          itemCode: li.item.code,
          itemName: li.item.name,
          unit: li.item.unit,
          returnedQty: rQty,
          condition: reqLine.condition,
          unitPrice: li.unitPrice.toFixed(2),
          taxRate: li.taxRate.toFixed(2),
          taxableAmount: split.taxableAmount,
          cgstAmount: split.cgstAmount,
          sgstAmount: split.sgstAmount,
          igstAmount: split.igstAmount,
          totalAmount: split.totalAmount,
        });
      }

      const grandCredit = money(
        totalTaxable.plus(totalCgst).plus(totalSgst).plus(totalIgst)
      );
      const creditNoteNumber = await getNextDocumentNumber(
        tx,
        DocumentType.CREDIT_NOTE
      );

      const cn = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: invoice.id,
          type: CreditNoteType.SALES_RETURN,
          taxableAmount: totalTaxable,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          amount: grandCredit,
          restocked: restockedTotalQty.gt(0),
          reason: v.reason,
          issuedById: actor.id,
          items: {
            create: preparedLines.map((pl) => ({
              invoiceItemId: pl.invoiceItemId,
              itemId: pl.itemId,
              returnedQty: pl.returnedQty,
              condition: pl.condition,
              unitPrice: pl.unitPrice,
              taxRate: pl.taxRate,
              taxableAmount: pl.taxableAmount,
              cgstAmount: pl.cgstAmount,
              sgstAmount: pl.sgstAmount,
              igstAmount: pl.igstAmount,
              totalAmount: pl.totalAmount,
            })),
          },
        },
      });

      // Restock only RESALEABLE returns into physical FIFO batches so Ledger == Batches invariant holds
      for (const pl of preparedLines) {
        if (pl.condition === ReturnCondition.RESALEABLE) {
          const latestBatch = await tx.stockBatch.findFirst({
            where: { itemId: pl.itemId },
            orderBy: { createdAt: "desc" },
            select: { unitRate: true },
          });
          await recordInwardBatchAndLedger(tx, {
            itemId: pl.itemId,
            unit: pl.unit,
            quantity: pl.returnedQty.toString(),
            unitRate: latestBatch?.unitRate.toString() ?? pl.unitPrice,
            movementType: MovementType.SALES_RETURN,
            referenceType: RefType.CREDIT_NOTE,
            referenceId: cn.id,
            batchNumber: `RET-${creditNoteNumber.replace(/\//g, "-")}-${pl.itemCode}`,
            createdById: actor.id,
            notes: `Sales return restock (${creditNoteNumber} / ${invoice.invoiceNumber})`,
          });
        }
      }

      // Recompute Invoice PaymentStatus accounting for all Credit Notes
      let priorCreditSum = money(0);
      for (const existingCn of invoice.creditNotes) {
        priorCreditSum = money(priorCreditSum.plus(existingCn.amount.toString()));
      }
      const nextCreditSum = money(priorCreditSum.plus(grandCredit));
      const paid = money(invoice.paidAmount.toString());
      const netCollectible = Decimal.max(
        money(0),
        money(invoice.totalAmount.toString()).minus(nextCreditSum)
      );
      const nextPayStatus = paid.gte(netCollectible)
        ? PaymentStatus.PAID
        : paid.gt(0)
          ? PaymentStatus.PARTIAL
          : PaymentStatus.UNPAID;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { paymentStatus: nextPayStatus },
      });

      await writeAuditLog(tx, {
        entityType: "CREDIT_NOTE",
        entityId: cn.id,
        action: "SALES_RETURN",
        userId: actor.id,
        changes: {
          creditNoteNumber,
          invoiceNumber: invoice.invoiceNumber,
          totalCredit: grandCredit.toFixed(2),
          restockedQty: restockedTotalQty.toString(),
          lines: preparedLines.map((p) => ({
            item: p.itemName,
            qty: p.returnedQty.toString(),
            condition: p.condition,
          })),
        },
        reason: v.reason,
      });

      return {
        creditNoteNumber,
        totalCredit: grandCredit.toFixed(2),
        restockedQty: restockedTotalQty.toString(),
      };
    });

    revalidatePath("/admin");
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/adjustments");
    revalidatePath("/auditor");
    revalidatePath("/dashboard");
    return { ok: true, data: res };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to record sales return"),
    };
  }
}

export async function cancelInvoiceWithCreditNoteAction(
  input: unknown
): Promise<ActionResult<{ creditNoteNumber: string; restocked: boolean }>> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = cancelInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reason" };
    }

    const { invoiceId, reason } = parsed.data;
    const res = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: { include: { item: true } } },
      });
      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new Error("Invoice is already cancelled.");
      }

      const creditNoteNumber = await getNextDocumentNumber(
        tx,
        DocumentType.CREDIT_NOTE
      );
      const dispatchedLines = invoice.items.filter((li) =>
        qty(li.dispatchedQty.toString()).gt(0)
      );
      const hadAnyDispatch =
        invoice.dispatchStatus !== DispatchStatus.PENDING_DISPATCH ||
        dispatchedLines.length > 0;

      const cn = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: invoice.id,
          type: CreditNoteType.CANCELLATION,
          taxableAmount: invoice.taxableAmount,
          cgstAmount: invoice.cgstAmount,
          sgstAmount: invoice.sgstAmount,
          igstAmount: invoice.igstAmount,
          amount: invoice.totalAmount,
          restocked: hadAnyDispatch,
          reason,
          issuedById: actor.id,
        },
      });

      // Only restock finished goods that were actually dispatched (supports partial dispatch!)
      if (hadAnyDispatch) {
        for (const li of invoice.items) {
          const restockQty =
            dispatchedLines.length > 0
              ? qty(li.dispatchedQty.toString())
              : qty(li.quantity.toString());
          if (restockQty.lte(0)) continue;

          const latestBatch = await tx.stockBatch.findFirst({
            where: { itemId: li.itemId },
            orderBy: { createdAt: "desc" },
            select: { unitRate: true },
          });
          await recordInwardBatchAndLedger(tx, {
            itemId: li.itemId,
            unit: li.item.unit,
            quantity: restockQty.toString(),
            unitRate: latestBatch?.unitRate.toString() ?? "0",
            movementType: MovementType.STOCK_ADJUSTMENT,
            referenceType: RefType.CREDIT_NOTE,
            referenceId: cn.id,
            batchNumber: `CN-${creditNoteNumber.replace(/\//g, "-")}-${li.item.code}`,
            createdById: actor.id,
            notes: `Restock from Credit Note ${creditNoteNumber} (${invoice.invoiceNumber})`,
          });
        }
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.CANCELLED },
      });

      await tx.order.update({
        where: { id: invoice.orderId },
        data: { status: OrderStatus.CANCELLED, rejectionReason: reason },
      });

      await writeAuditLog(tx, {
        entityType: "CREDIT_NOTE",
        entityId: cn.id,
        action: "CANCEL",
        userId: actor.id,
        changes: {
          creditNoteNumber,
          invoiceNumber: invoice.invoiceNumber,
          restocked: hadAnyDispatch,
        },
        reason,
      });

      return { creditNoteNumber, restocked: hadAnyDispatch };
    });

    revalidatePath("/admin");
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/adjustments");
    revalidatePath("/salesman/orders");
    return { ok: true, data: res };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to issue credit note"),
    };
  }
}

export async function generateMockEInvoiceAction(invoiceId: string): Promise<
  ActionResult<{
    irn: string;
    eInvoiceJson: unknown;
    eWayBillJson: unknown;
  }>
> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);

    const res = await prisma.$transaction(async (tx) => {
      const [settings, invoice] = await Promise.all([
        tx.companySettings.findUnique({ where: { id: "default" } }),
        tx.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            customer: true,
            items: { include: { item: true } },
          },
        }),
      ]);

      if (!settings?.isConfigured) {
        throw new Error("Configure Company Settings before generating e-Invoice JSON.");
      }
      if (!invoice) throw new Error("Invoice not found.");

      const docs = generateMockNicDocuments({
        invoiceNumber: invoice.invoiceNumber,
        invoiceDateIso: invoice.invoiceDate.toISOString(),
        financialYear: getFinancialYear(invoice.invoiceDate),
        seller: {
          gstin: settings.gstin,
          legalName: settings.companyName,
          address: settings.address,
          state: settings.state,
          stateCode: settings.stateCode,
          phone: settings.phone,
        },
        buyer: {
          gstin: invoice.customer.gstin,
          legalName: invoice.customer.name,
          address: invoice.customer.address,
          state: invoice.customer.state,
          stateCode: invoice.customer.stateCode,
          phone: invoice.customer.phone,
        },
        taxableAmount: invoice.taxableAmount.toFixed(2),
        cgstAmount: invoice.cgstAmount.toFixed(2),
        sgstAmount: invoice.sgstAmount.toFixed(2),
        igstAmount: invoice.igstAmount.toFixed(2),
        totalAmount: invoice.totalAmount.toFixed(2),
        items: invoice.items.map((li, idx) => ({
          slNo: idx + 1,
          itemName: li.item.name,
          hsnCode: li.hsnCode,
          qty: li.quantity.toFixed(3),
          unit: li.item.unit,
          unitPrice: li.unitPrice.toFixed(2),
          taxableAmount: li.taxableAmount.toFixed(2),
          taxRate: li.taxRate.toFixed(2),
          cgstAmount: li.cgstAmount.toFixed(2),
          sgstAmount: li.sgstAmount.toFixed(2),
          igstAmount: li.igstAmount.toFixed(2),
          totalAmount: li.totalAmount.toFixed(2),
        })),
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          eInvoiceMeta: {
            irn: docs.irn,
            ackNo: docs.ackNo,
            ackDt: docs.ackDt,
            signedQr: docs.eInvoiceJson.SignedQRCode,
          },
        },
      });

      await writeAuditLog(tx, {
        entityType: "INVOICE",
        entityId: invoice.id,
        action: "UPDATE",
        userId: actor.id,
        changes: { mockIrn: docs.irn, ackNo: docs.ackNo },
        reason: "Generated mocked NIC e-Invoice & e-Way Bill JSON",
      });

      return {
        irn: docs.irn,
        eInvoiceJson: docs.eInvoiceJson,
        eWayBillJson: docs.eWayBillJson,
      };
    });

    revalidatePath("/admin/invoices");
    return { ok: true, data: res };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to generate e-Invoice JSON"),
    };
  }
}

export async function recordCustomerPaymentAction(
  input: unknown
): Promise<ActionResult<{ paymentId: string }>> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = recordCustomerPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment" };
    }

    const v = parsed.data;
    const paymentDate = new Date(v.paymentDate);
    if (Number.isNaN(paymentDate.getTime())) {
      return { ok: false, error: "Invalid payment date." };
    }

    const res = await prisma.$transaction(async (tx) => {
      const payAmount = money(v.amount);

      if (v.invoiceId) {
        const inv = await tx.invoice.findUnique({
          where: { id: v.invoiceId },
          include: { creditNotes: { select: { amount: true } } },
        });
        if (!inv || inv.customerId !== v.customerId) {
          throw new Error("Invoice not found for selected customer.");
        }
        if (inv.status !== InvoiceStatus.POSTED) {
          throw new Error("Cannot record payment against a cancelled invoice.");
        }
        let creditTotal = money(0);
        for (const cn of inv.creditNotes) {
          creditTotal = money(creditTotal.plus(cn.amount.toString()));
        }
        const paid = money(inv.paidAmount.toString());
        const netTotal = Decimal.max(
          money(0),
          money(inv.totalAmount.toString()).minus(creditTotal)
        );
        const remaining = Decimal.max(money(0), money(netTotal.minus(paid)));
        if (payAmount.gt(remaining)) {
          throw new Error(
            `Payment ₹${payAmount.toFixed(2)} exceeds remaining invoice balance ₹${remaining.toFixed(2)}.`
          );
        }

        const nextPaid = money(paid.plus(payAmount));
        const nextStatus = nextPaid.gte(netTotal)
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIAL;

        const payment = await tx.payment.create({
          data: {
            customerId: v.customerId,
            invoiceId: inv.id,
            recordedById: actor.id,
            paymentDate,
            amount: payAmount,
            paymentMode: v.paymentMode,
            referenceNumber: v.referenceNumber || null,
            notes: v.notes || null,
          },
        });

        await tx.invoice.update({
          where: { id: inv.id },
          data: { paidAmount: nextPaid, paymentStatus: nextStatus },
        });

        await writeAuditLog(tx, {
          entityType: "PAYMENT",
          entityId: payment.id,
          action: "CREATE",
          userId: actor.id,
          changes: {
            invoiceNumber: inv.invoiceNumber,
            amount: payAmount.toFixed(2),
            paymentStatus: nextStatus,
          },
        });

        return { paymentId: payment.id };
      }

      // FIFO allocation across oldest open invoices
      const openInvoices = await tx.invoice.findMany({
        where: {
          customerId: v.customerId,
          status: InvoiceStatus.POSTED,
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
        },
        include: { creditNotes: { select: { amount: true } } },
        orderBy: { invoiceDate: "asc" },
      });

      const getNetTotal = (inv: (typeof openInvoices)[number]) => {
        let cnSum = money(0);
        for (const cn of inv.creditNotes) {
          cnSum = money(cnSum.plus(cn.amount.toString()));
        }
        return Decimal.max(money(0), money(inv.totalAmount.toString()).minus(cnSum));
      };

      let totalOpen = money(0);
      for (const inv of openInvoices) {
        totalOpen = money(
          totalOpen.plus(
            Decimal.max(money(0), money(getNetTotal(inv).minus(inv.paidAmount.toString())))
          )
        );
      }

      if (payAmount.gt(totalOpen)) {
        throw new Error(
          `Payment ₹${payAmount.toFixed(2)} exceeds customer's total outstanding balance ₹${totalOpen.toFixed(2)}.`
        );
      }

      let remainingToAllocate = payAmount;
      let firstPaymentId = "";

      for (const inv of openInvoices) {
        if (remainingToAllocate.lte(0)) break;
        const paid = money(inv.paidAmount.toString());
        const netTotal = getNetTotal(inv);
        const invDue = Decimal.max(money(0), money(netTotal.minus(paid)));
        if (invDue.lte(0)) continue;

        const alloc = Decimal.min(invDue, remainingToAllocate);
        const nextPaid = money(paid.plus(alloc));
        const nextStatus = nextPaid.gte(netTotal)
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIAL;

        const payment = await tx.payment.create({
          data: {
            customerId: v.customerId,
            invoiceId: inv.id,
            recordedById: actor.id,
            paymentDate,
            amount: alloc,
            paymentMode: v.paymentMode,
            referenceNumber: v.referenceNumber || null,
            notes: v.notes || `FIFO settlement against ${inv.invoiceNumber}`,
          },
        });
        if (!firstPaymentId) firstPaymentId = payment.id;

        await tx.invoice.update({
          where: { id: inv.id },
          data: { paidAmount: nextPaid, paymentStatus: nextStatus },
        });

        remainingToAllocate = money(remainingToAllocate.minus(alloc));
      }

      await writeAuditLog(tx, {
        entityType: "PAYMENT",
        entityId: firstPaymentId,
        action: "CREATE",
        userId: actor.id,
        changes: {
          customerId: v.customerId,
          totalAllocated: payAmount.toFixed(2),
        },
      });

      return { paymentId: firstPaymentId };
    });

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/invoices");
    return { ok: true, data: res };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to record payment"),
    };
  }
}
