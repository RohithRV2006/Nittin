import { UnitType } from "@prisma/client";
import { z } from "zod";

export const orderLineInputSchema = z.object({
  itemId: z.string().uuid("Select a valid product"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  inputUnit: z.nativeEnum(UnitType).default(UnitType.PACKET),
});

export const createFieldOrderSchema = z.object({
  clientRequestId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid("Select a customer"),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
  items: z
    .array(orderLineInputSchema)
    .min(1, "Add at least one product to the order"),
});

export const cancelFieldOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(3, "Provide a brief cancellation reason").max(200),
});
