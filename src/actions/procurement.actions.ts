"use server";
import { toSafeErrorMessage } from "@/lib/errors";

import { revalidatePath } from "next/cache";
import {
  DocumentType,
  GrnStatus,
  ItemCategory,
  MovementType,
  PaymentStatus,
  RefType,
  Role,
} from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth";
import { money, percent, qty, toDec } from "@/lib/decimal";
import { writeAuditLog } from "@/lib/engines/audit";
import { getNextDocumentNumber } from "@/lib/engines/sequence";
import {
  consumeFifoBatches,
  recordInwardBatchAndLedger,
} from "@/lib/engines/stock";
import { computeGstSplit } from "@/lib/engines/tax";
import { isIntegerUnit } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { convertUnit } from "@/lib/units";
import {
  createGoodsReceiptSchema,
  createPurchaseSchema,
  rejectGrnSchema,
  stockAdjustmentSchema,
  supplierPaymentSchema,
} from "@/lib/validators/phase1";
import type { ActionResult } from "./masters.actions";

export async function recordPurchaseAction(
  input: unknown
): Promise<ActionResult<{ purchaseNumber: string }>> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = createPurchaseSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid purchase" };
    }

    const v = parsed.data;
    const purchaseDate = new Date(v.purchaseDate);
    if (Number.isNaN(purchaseDate.getTime())) {
      return { ok: false, error: "Invalid purchase date." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const settings = await tx.companySettings.findUnique({
        where: { id: "default" },
      });
      if (!settings?.isConfigured || !settings.stateCode) {
        throw new Error(
          "Company GST profile and state code must be configured by the Business Owner before recording purchases."
        );
      }

      const supplier = await tx.supplier.findUnique({
        where: { id: v.supplierId },
      });
      if (!supplier || !supplier.active) {
        throw new Error("Selected supplier is missing or inactive.");
      }

      const itemIds = [...new Set(v.lines.map((l) => l.itemId))];
      const items = await tx.item.findMany({ where: { id: { in: itemIds } } });
      const itemMap = new Map(items.map((i) => [i.id, i]));

      const purchaseNumber = await getNextDocumentNumber(
        tx,
        DocumentType.PURCHASE,
        purchaseDate
      );

      let totalTaxable = money(0);
      let totalCgst = money(0);
      let totalSgst = money(0);
      let totalIgst = money(0);

      const preparedLines = v.lines.map((line, index) => {
        const item = itemMap.get(line.itemId);
        if (!item || !item.active) {
          throw new Error("One or more selected items are missing or inactive.");
        }
        if (item.category === ItemCategory.FINISHED_GOOD) {
          throw new Error(
            `${item.name} is a Finished Good and cannot be purchased via inward procurement; produce it via a Production Run.`
          );
        }

        const baseQty = convertUnit(line.quantity, line.inputUnit, item.unit, {
          unitsPerCarton: item.unitsPerCarton,
        });

        const inputLineTaxable = money(
          toDec(line.quantity).mul(toDec(line.unitRatePerInputUnit))
        );
        const unitRateBase = money(inputLineTaxable.div(baseQty));
        const taxSplit = computeGstSplit(
          inputLineTaxable,
          line.taxRate,
          supplier.stateCode,
          settings.stateCode
        );

        totalTaxable = money(totalTaxable.plus(taxSplit.taxableAmount));
        totalCgst = money(totalCgst.plus(taxSplit.cgstAmount));
        totalSgst = money(totalSgst.plus(taxSplit.sgstAmount));
        totalIgst = money(totalIgst.plus(taxSplit.igstAmount));

        const batchCode =
          line.batchNumber?.trim() ||
          `BATCH-${purchaseNumber.replace(/\//g, "-")}-${index + 1}`;

        const expiryDate = line.expiryDate ? new Date(line.expiryDate) : null;

        return {
          item,
          baseQty,
          unitRateBase,
          taxRate: percent(line.taxRate),
          taxableAmount: taxSplit.taxableAmount,
          taxAmount: taxSplit.totalTax,
          totalAmount: taxSplit.totalAmount,
          batchNumber: batchCode,
          expiryDate,
        };
      });

      const grandTotal = money(
        totalTaxable.plus(totalCgst).plus(totalSgst).plus(totalIgst)
      );

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: supplier.id,
          billNumber: v.billNumber,
          purchaseDate,
          placeOfSupply: supplier.state,
          taxableAmount: totalTaxable,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          totalAmount: grandTotal,
          createdById: actor.id,
        },
      });

      for (const line of preparedLines) {
        const purchaseItem = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            itemId: line.item.id,
            quantity: line.baseQty,
            unit: line.item.unit,
            unitRate: line.unitRateBase,
            taxRate: line.taxRate,
            taxableAmount: line.taxableAmount,
            taxAmount: line.taxAmount,
            totalAmount: line.totalAmount,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate,
          },
        });

        await recordInwardBatchAndLedger(tx, {
          itemId: line.item.id,
          unit: line.item.unit,
          quantity: line.baseQty,
          unitRate: line.unitRateBase,
          movementType: MovementType.PURCHASE_RECEIPT,
          referenceType: RefType.PURCHASE,
          referenceId: purchase.id,
          purchaseItemId: purchaseItem.id,
          batchNumber: line.batchNumber,
          receivedDate: purchaseDate,
          expiryDate: line.expiryDate,
          createdById: actor.id,
          notes: `Purchase ${purchaseNumber} (Bill: ${v.billNumber})`,
        });
      }

      if (v.grnId) {
        const grn = await tx.goodsReceipt.findUnique({ where: { id: v.grnId } });
        if (!grn || grn.status !== GrnStatus.PENDING_BILLING) {
          throw new Error("Linked floor GRN is no longer pending billing.");
        }
        if (grn.supplierId !== v.supplierId) {
          throw new Error("Purchase supplier must match the linked GRN supplier.");
        }
        await tx.goodsReceipt.update({
          where: { id: grn.id },
          data: {
            status: GrnStatus.VERIFIED,
            verifiedById: actor.id,
            verifiedAt: new Date(),
            purchaseId: purchase.id,
          },
        });
      }

      await writeAuditLog(tx, {
        entityType: "PURCHASE",
        entityId: purchase.id,
        action: "CREATE",
        userId: actor.id,
        changes: {
          purchaseNumber,
          billNumber: v.billNumber,
          grnId: v.grnId || null,
          totalAmount: grandTotal.toFixed(2),
        },
      });

      return { purchaseNumber };
    });

    revalidatePath("/admin/purchases");
    revalidatePath("/admin/adjustments");
    revalidatePath("/admin");
    revalidatePath("/production/receiving");
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to record purchase"),
    };
  }
}

export async function createGoodsReceiptAction(
  input: unknown
): Promise<ActionResult<{ grnNumber: string }>> {
  try {
    const actor = await requireVerifiedUser([Role.PRODUCTION_SUPERVISOR]);
    const parsed = createGoodsReceiptSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid GRN" };
    }

    const v = parsed.data;
    const receivedDate = new Date(v.receivedDate);
    if (Number.isNaN(receivedDate.getTime())) {
      return { ok: false, error: "Invalid received date." };
    }

    const res = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: v.supplierId } });
      if (!supplier || !supplier.active) {
        throw new Error("Selected supplier not found or inactive.");
      }

      const dbItems = await tx.item.findMany({
        where: { id: { in: v.lines.map((l) => l.itemId) }, active: true },
      });
      const itemMap = new Map(dbItems.map((i) => [i.id, i]));

      const prepared = v.lines.map((line) => {
        const item = itemMap.get(line.itemId);
        if (!item) throw new Error("Invalid item selected in GRN.");
        const dQty = qty(line.quantity);
        if (isIntegerUnit(line.inputUnit) && !dQty.isInteger()) {
          throw new Error(
            `${item.name} uses ${line.inputUnit} and must be received as a whole number.`
          );
        }
        return {
          itemId: item.id,
          quantity: dQty,
          unit: line.inputUnit,
          batchNumber: line.batchNumber || null,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
          notes: line.notes || null,
        };
      });

      const grnNumber = await getNextDocumentNumber(tx, DocumentType.GRN, receivedDate);
      const grn = await tx.goodsReceipt.create({
        data: {
          grnNumber,
          supplierId: supplier.id,
          challanNumber: v.challanNumber,
          receivedDate,
          status: GrnStatus.PENDING_BILLING,
          notes: v.notes || null,
          receivedById: actor.id,
          items: { create: prepared },
        },
      });

      await writeAuditLog(tx, {
        entityType: "GOODS_RECEIPT",
        entityId: grn.id,
        action: "CREATE",
        userId: actor.id,
        changes: {
          grnNumber,
          supplierName: supplier.name,
          challanNumber: v.challanNumber,
          lineCount: prepared.length,
        },
      });

      return { grnNumber };
    });

    revalidatePath("/production/receiving");
    revalidatePath("/admin/purchases");
    return { ok: true, data: res };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to log GRN"),
    };
  }
}

export async function rejectGoodsReceiptAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = rejectGrnSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reason" };
    }

    await prisma.$transaction(async (tx) => {
      const grn = await tx.goodsReceipt.findUnique({ where: { id: parsed.data.grnId } });
      if (!grn) throw new Error("GRN not found.");
      if (grn.status !== GrnStatus.PENDING_BILLING) {
        throw new Error("Only pending GRNs can be rejected.");
      }

      await tx.goodsReceipt.update({
        where: { id: grn.id },
        data: {
          status: GrnStatus.REJECTED,
          verifiedById: actor.id,
          verifiedAt: new Date(),
          rejectionReason: parsed.data.reason,
        },
      });

      await writeAuditLog(tx, {
        entityType: "GOODS_RECEIPT",
        entityId: grn.id,
        action: "REJECT",
        userId: actor.id,
        reason: parsed.data.reason,
      });
    });

    revalidatePath("/admin/purchases");
    revalidatePath("/production/receiving");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to reject GRN"),
    };
  }
}

export async function recordSupplierPaymentAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = supplierPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment" };
    }

    const v = parsed.data;
    const paymentDate = new Date(v.paymentDate);

    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id: v.purchaseId },
      });
      if (!purchase) {
        throw new Error("Purchase record not found.");
      }

      const payAmount = money(v.amount);
      const existingPaid = money(purchase.paidAmount.toString());
      const billTotal = money(purchase.totalAmount.toString());
      const remaining = money(billTotal.minus(existingPaid));

      if (payAmount.gt(remaining)) {
        throw new Error(
          `Payment ₹${payAmount.toFixed(2)} exceeds remaining bill balance ₹${remaining.toFixed(2)}.`
        );
      }

      const nextPaid = money(existingPaid.plus(payAmount));
      const nextStatus = nextPaid.gte(billTotal)
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIAL;

      const sp = await tx.supplierPayment.create({
        data: {
          supplierId: purchase.supplierId,
          purchaseId: purchase.id,
          recordedById: actor.id,
          paymentDate,
          amount: payAmount,
          paymentMode: v.paymentMode,
          referenceNumber: v.referenceNumber || null,
          notes: v.notes || null,
        },
      });

      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          paidAmount: nextPaid,
          paymentStatus: nextStatus,
        },
      });

      await writeAuditLog(tx, {
        entityType: "PURCHASE",
        entityId: purchase.id,
        action: "UPDATE",
        userId: actor.id,
        changes: {
          supplierPaymentId: sp.id,
          paidAmount: payAmount.toFixed(2),
          paymentStatus: nextStatus,
        },
      });
    });

    revalidatePath("/admin/purchases");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to record supplier payment"),
    };
  }
}

export async function recordStockAdjustmentAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser([Role.FACTORY_ADMIN]);
    const parsed = stockAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid adjustment" };
    }

    const v = parsed.data;
    await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: v.itemId } });
      if (!item || !item.active) {
        throw new Error("Item not found or inactive.");
      }

      const adjQty = qty(v.quantity);
      const refId = `ADJ-${Date.now()}`;

      if (v.direction === "INCREASE") {
        const rate = money(v.unitRate ?? 0);
        const batchNumber =
          v.batchNumber?.trim() || `BATCH-ADJ-${Date.now().toString(36).toUpperCase()}`;
        const expiryDate = v.expiryDate ? new Date(v.expiryDate) : null;

        await recordInwardBatchAndLedger(tx, {
          itemId: item.id,
          unit: item.unit,
          quantity: adjQty,
          unitRate: rate,
          movementType: MovementType.STOCK_ADJUSTMENT,
          referenceType: RefType.ADJUSTMENT,
          referenceId: refId,
          batchNumber,
          expiryDate,
          createdById: actor.id,
          notes: v.reason,
        });
      } else {
        await consumeFifoBatches(tx, {
          itemId: item.id,
          unit: item.unit,
          requiredQty: adjQty,
          movementType: MovementType.STOCK_ADJUSTMENT,
          referenceType: RefType.ADJUSTMENT,
          referenceId: refId,
          createdById: actor.id,
          notes: v.reason,
        });
      }

      await writeAuditLog(tx, {
        entityType: "STOCK_ADJUSTMENT",
        entityId: item.id,
        action: "ADJUST",
        userId: actor.id,
        changes: {
          itemCode: item.code,
          direction: v.direction,
          quantity: adjQty.toFixed(3),
        },
        reason: v.reason,
      });
    });

    revalidatePath("/admin/adjustments");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to record adjustment"),
    };
  }
}
