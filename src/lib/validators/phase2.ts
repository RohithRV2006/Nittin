import { UnitType } from "@prisma/client";
import { z } from "zod";

export const bomItemSchema = z.object({
  itemId: z.string().uuid("Select an ingredient or packaging item"),
  standardQty: z.coerce.number().positive("Standard quantity must be > 0"),
  unit: z.nativeEnum(UnitType),
});

export const bomSchema = z.object({
  id: z.string().uuid().optional(),
  finishedItemId: z.string().uuid("Select a finished product"),
  name: z.string().trim().min(2, "Recipe name is required").max(120),
  batchSizeOutput: z.coerce.number().positive("Expected batch output must be > 0"),
  tolerancePercent: z.coerce.number().min(0).max(50).default(3),
  items: z.array(bomItemSchema).min(1, "Add at least one BOM line item"),
});

export const cloneBomSchema = z.object({
  sourceBomId: z.string().uuid(),
  targetFinishedItemId: z.string().uuid(),
  name: z.string().trim().min(2, "New recipe name is required").max(120),
  scaleFactor: z.coerce.number().positive("Scale factor must be > 0"),
  batchSizeOutput: z.coerce.number().positive("Expected batch output must be > 0"),
});

export const runConsumptionLineSchema = z
  .object({
    itemId: z.string().uuid(),
    actualIssuedQty: z.coerce.number().min(0, "Issued quantity cannot be negative"),
    inputUnit: z.nativeEnum(UnitType),
    scrapDamagedQty: z.coerce
      .number()
      .min(0, "Scrap/damaged quantity cannot be negative")
      .default(0),
    scrapInputUnit: z.nativeEnum(UnitType).optional(),
  })
  .refine(
    (d) => d.scrapDamagedQty <= d.actualIssuedQty || d.scrapInputUnit !== undefined,
    {
      message: "Scrap/damaged quantity cannot exceed total issued quantity",
    }
  );

export const productionRunInputSchema = z.object({
  runId: z.string().uuid().optional(),
  bomId: z.string().uuid("Select a BOM recipe"),
  mode: z.enum(["COMPLETE_NOW", "START_RUN", "COMPLETE_EXISTING"]),
  batchMultiplier: z.coerce
    .number()
    .positive("Batch multiplier must be > 0")
    .max(100)
    .default(1),
  runDate: z.string().min(1, "Run date is required"),
  actualOutput: z.coerce
    .number()
    .min(0, "Actual output cannot be negative")
    .default(0),
  labourCost: z.coerce.number().min(0, "Labour cost cannot be negative").default(0),
  powerGasCost: z.coerce
    .number()
    .min(0, "Power/Gas cost cannot be negative")
    .default(0),
  expiryDate: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
  consumptions: z.array(runConsumptionLineSchema).min(1),
});

export const cancelRunSchema = z.object({
  runId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(5, "Cancellation reason must be at least 5 characters")
    .max(300),
});
