import {
  CustomerType,
  ItemCategory,
  PaymentMode,
  Role,
  UnitType,
} from "@prisma/client";
import { z } from "zod";

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const stateCodeRegex = /^[0-9]{2}$/;

export const companySettingsSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(150),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstinRegex, "Enter a valid 15-character GSTIN"),
  state: z.string().trim().min(2, "State name is required").max(80),
  stateCode: z
    .string()
    .trim()
    .regex(stateCodeRegex, "State code must be 2 digits (e.g., 33, 29)"),
  address: z.string().trim().min(5, "Factory address is required").max(300),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  bankDetails: z.string().trim().max(300).optional().or(z.literal("")),
  defaultTolerancePercent: z.coerce
    .number()
    .min(0, "Tolerance cannot be negative")
    .max(50, "Tolerance cannot exceed 50%"),
});

export const itemSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "SKU code is required")
    .max(40),
  name: z.string().trim().min(2, "Item name is required").max(120),
  category: z.nativeEnum(ItemCategory),
  unit: z.nativeEnum(UnitType),
  packWeightGrams: z.coerce.number().positive().optional().nullable(),
  unitsPerCarton: z.coerce.number().int().positive().optional().nullable(),
  hsnCode: z.string().trim().min(4, "HSN code must be 4-8 digits").max(12),
  taxRate: z.coerce.number().min(0).max(28),
  sellingPrice: z.coerce.number().min(0).optional().nullable(),
  reorderLevel: z.coerce.number().min(0).default(0),
});

export const customerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Customer name is required").max(120),
  type: z.nativeEnum(CustomerType),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstinRegex, "Invalid 15-character GSTIN")
    .optional()
    .or(z.literal("")),
  state: z.string().trim().min(2, "State is required").max(80),
  stateCode: z
    .string()
    .trim()
    .regex(stateCodeRegex, "State code must be 2 digits"),
  phone: z.string().trim().min(7, "Phone is required").max(20),
  address: z.string().trim().min(4, "Address is required").max(300),
  creditLimit: z.coerce.number().min(0).default(0),
  creditDays: z.coerce.number().int().min(0).max(365).default(30),
  assignedSalesmanId: z.string().uuid().optional().or(z.literal("")),
});

export const customerPriceSchema = z.object({
  customerId: z.string().uuid(),
  itemId: z.string().uuid(),
  customPrice: z.coerce.number().positive("Custom price must be > 0"),
});

export const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Supplier name is required").max(120),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstinRegex, "Invalid 15-character GSTIN")
    .optional()
    .or(z.literal("")),
  state: z.string().trim().min(2, "State is required").max(80),
  stateCode: z
    .string()
    .trim()
    .regex(stateCodeRegex, "State code must be 2 digits"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});

export const passwordPolicySchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100)
  .regex(/[A-Za-z]/, "Password must include at least one letter")
  .regex(/[0-9]/, "Password must include at least one number");

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Full name is required").max(100),
  email: z.string().trim().email("Valid email is required").toLowerCase(),
  password: passwordPolicySchema,
  role: z.nativeEnum(Role),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

export const adminResetPasswordSchema = z.object({
  userId: z.string().uuid(),
  temporaryPassword: passwordPolicySchema,
});

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordPolicySchema,
});

export const purchaseLineSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce.number().positive("Quantity must be > 0"),
  inputUnit: z.nativeEnum(UnitType),
  unitRatePerInputUnit: z.coerce.number().min(0, "Rate cannot be negative"),
  taxRate: z.coerce.number().min(0).max(28),
  batchNumber: z.string().trim().max(60).optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid("Select a supplier"),
  billNumber: z.string().trim().min(1, "Supplier bill number is required").max(60),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  grnId: z.string().uuid().optional().or(z.literal("")),
  lines: z.array(purchaseLineSchema).min(1, "Add at least one purchase item"),
});

export const grnLineSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce.number().positive("Quantity must be > 0"),
  inputUnit: z.nativeEnum(UnitType),
  batchNumber: z.string().trim().max(60).optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(150).optional().or(z.literal("")),
});

export const createGoodsReceiptSchema = z.object({
  supplierId: z.string().uuid("Select a supplier"),
  challanNumber: z.string().trim().min(1, "Delivery challan # is required").max(60),
  receivedDate: z.string().min(1, "Received date is required"),
  notes: z.string().trim().max(250).optional().or(z.literal("")),
  lines: z.array(grnLineSchema).min(1, "Add at least one received item"),
});

export const rejectGrnSchema = z.object({
  grnId: z.string().uuid(),
  reason: z.string().trim().min(5, "Audit reason must be at least 5 characters").max(250),
});

export const supplierPaymentSchema = z.object({
  purchaseId: z.string().uuid(),
  amount: z.coerce.number().positive("Payment amount must be > 0"),
  paymentMode: z.nativeEnum(PaymentMode),
  paymentDate: z.string().min(1, "Payment date is required"),
  referenceNumber: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(250).optional().or(z.literal("")),
});

export const stockAdjustmentSchema = z.object({
  itemId: z.string().uuid("Select an item"),
  direction: z.enum(["INCREASE", "DECREASE"]),
  quantity: z.coerce.number().positive("Adjustment quantity must be > 0"),
  unitRate: z.coerce.number().min(0).optional().nullable(),
  batchNumber: z.string().trim().max(60).optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
  reason: z
    .string()
    .trim()
    .min(5, "Audit reason must be at least 5 characters")
    .max(300),
});
