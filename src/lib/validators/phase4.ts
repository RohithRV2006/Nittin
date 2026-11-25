import { PaymentMode, ReturnCondition } from "@prisma/client";
import { z } from "zod";

export const orderItemOverrideSchema = z.object({
  orderItemId: z.string().uuid(),
  quantity: z.coerce.number().positive("Quantity must be > 0"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
});

export const approveOrderSchema = z.object({
  orderId: z.string().uuid(),
  items: z.array(orderItemOverrideSchema).min(1),
});

export const holdOrderSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const rejectOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(3, "Rejection reason is required").max(300),
});

export const dispatchLineSchema = z.object({
  invoiceItemId: z.string().uuid(),
  quantity: z.coerce.number().positive("Dispatch quantity must be > 0"),
});

export const dispatchInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  preferFefo: z.boolean().default(true),
  vehicleNumber: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(250).optional().or(z.literal("")),
  items: z.array(dispatchLineSchema).min(1).optional(),
});

export const salesReturnLineSchema = z.object({
  invoiceItemId: z.string().uuid(),
  quantity: z.coerce.number().positive("Return quantity must be > 0"),
  condition: z.nativeEnum(ReturnCondition),
});

export const recordSalesReturnSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(5, "Return audit reason must be at least 5 characters")
    .max(300),
  items: z.array(salesReturnLineSchema).min(1, "Select at least one item to return"),
});

export const cancelInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(5, "Audit cancellation reason must be at least 5 characters")
    .max(300),
});

export const recordCustomerPaymentSchema = z.object({
  customerId: z.string().uuid("Select a customer"),
  invoiceId: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Payment amount must be greater than 0"),
  paymentMode: z.nativeEnum(PaymentMode),
  paymentDate: z.string().min(1, "Payment date is required"),
  referenceNumber: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(250).optional().or(z.literal("")),
});
