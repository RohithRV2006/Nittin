"use server";

import { revalidatePath } from "next/cache";
import {
  DispatchStatus,
  DocumentType,
  InvoiceStatus,
  MovementType,
  OrderStatus,
  PaymentStatus,
  RefType,
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
import { prisma } from "@/lib/prisma";
import { getFinancialYear } from "@/lib/security";
import {
  approveOrderSchema,
  cancelInvoiceSchema,
  dispatchInvoiceSchema,
  holdOrderSchema,
  recordCustomerPaymentSchema,
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
      error: err instanceof Error ? err.message : "Failed to generate GST invoice",
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
    return { ok: false, error: err instanceof Error ? err.message : "Action failed" };
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
    return { ok: false, error: err instanceof Error ? err.message : "Rejection failed" };
  }
}

export async function recordDispatchAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = dispatchInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid dispatch payload" };
    }

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: parsed.data.invoiceId },
        include: { items: { include: { item: true } } },
      });

      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.status !== InvoiceStatus.POSTED) {
        throw new Error("Cancelled invoices cannot be dispatched.");
      }
      if (invoice.dispatchStatus === DispatchStatus.DISPATCHED) {
        throw new Error("Invoice has already been dispatched.");
      }

      for (const li of invoice.items) {
        await consumeFifoBatches(tx, {
          itemId: li.itemId,
          unit: li.item.unit,
          requiredQty: li.quantity.toString(),
          movementType: MovementType.DISPATCH_SALE,
          referenceType: RefType.INVOICE,
          referenceId: invoice.id,
          createdById: actor.id,
          notes: `Dispatch for ${invoice.invoiceNumber}`,
          preferFefo: parsed.data.preferFefo,
        });
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          dispatchStatus: DispatchStatus.DISPATCHED,
          dispatchedAt: new Date(),
          dispatchedById: actor.id,
        },
      });

      await tx.order.update({
        where: { id: invoice.orderId },
        data: { status: OrderStatus.DISPATCHED },
      });

      await writeAuditLog(tx, {
        entityType: "INVOICE",
        entityId: invoice.id,
        action: "DISPATCH",
        userId: actor.id,
        changes: { invoiceNumber: invoice.invoiceNumber, dispatchStatus: "DISPATCHED" },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/adjustments");
    revalidatePath("/salesman");
    revalidatePath("/salesman/orders");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record dispatch",
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
      const wasDispatched = invoice.dispatchStatus === DispatchStatus.DISPATCHED;

      const cn = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: invoice.id,
          taxableAmount: invoice.taxableAmount,
          cgstAmount: invoice.cgstAmount,
          sgstAmount: invoice.sgstAmount,
          igstAmount: invoice.igstAmount,
          amount: invoice.totalAmount,
          restocked: wasDispatched,
          reason,
          issuedById: actor.id,
        },
      });

      // Only restock finished goods if physical dispatch actually happened
      if (wasDispatched) {
        for (const li of invoice.items) {
          const latestBatch = await tx.stockBatch.findFirst({
            where: { itemId: li.itemId },
            orderBy: { createdAt: "desc" },
            select: { unitRate: true },
          });
          await recordInwardBatchAndLedger(tx, {
            itemId: li.itemId,
            unit: li.item.unit,
            quantity: li.quantity.toString(),
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
          restocked: wasDispatched,
        },
        reason,
      });

      return { creditNoteNumber, restocked: wasDispatched };
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
      error: err instanceof Error ? err.message : "Failed to issue credit note",
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
      error: err instanceof Error ? err.message : "Failed to generate e-Invoice JSON",
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
        const inv = await tx.invoice.findUnique({ where: { id: v.invoiceId } });
        if (!inv || inv.customerId !== v.customerId) {
          throw new Error("Invoice not found for selected customer.");
        }
        if (inv.status !== InvoiceStatus.POSTED) {
          throw new Error("Cannot record payment against a cancelled invoice.");
        }
        const paid = money(inv.paidAmount.toString());
        const total = money(inv.totalAmount.toString());
        const remaining = money(total.minus(paid));
        if (payAmount.gt(remaining)) {
          throw new Error(
            `Payment ₹${payAmount.toFixed(2)} exceeds remaining invoice balance ₹${remaining.toFixed(2)}.`
          );
        }

        const nextPaid = money(paid.plus(payAmount));
        const nextStatus = nextPaid.gte(total)
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
        orderBy: { invoiceDate: "asc" },
      });

      let totalOpen = money(0);
      for (const inv of openInvoices) {
        totalOpen = money(
          totalOpen.plus(money(inv.totalAmount.toString()).minus(inv.paidAmount.toString()))
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
        const total = money(inv.totalAmount.toString());
        const invDue = money(total.minus(paid));
        if (invDue.lte(0)) continue;

        const alloc = Decimal.min(invDue, remainingToAllocate);
        const nextPaid = money(paid.plus(alloc));
        const nextStatus = nextPaid.gte(total)
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
      error: err instanceof Error ? err.message : "Failed to record payment",
    };
  }
}
