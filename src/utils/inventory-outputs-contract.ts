import { z } from "zod";

const requiredId = (message: string) =>
  z.string({ message }).trim().min(1, message);

const positiveQuantity = z
  .union([z.number(), z.string()])
  .transform((value) => Number(String(value).trim()))
  .refine((value) => Number.isFinite(value) && value > 0, {
    message: "quantity must be positive",
  });

export const inventoryOutputLocationSchema = z.union([
  z.literal("BODEGA_PRINCIPAL"),
  z.literal("TIENDA"),
]);

export const inventoryOutputMutationSchema = z.object({
  inventoryItemId: requiredId("inventoryItemId required"),
  variantId: requiredId("variantId required"),
  orderItemId: z.string().optional().nullable().default(""),
  warehouseId: z.string().optional().nullable().default(""),
  location: inventoryOutputLocationSchema.optional(),
  quantity: positiveQuantity,
  reason: z.string({ message: "reason required" }).trim().min(1, "reason required"),
});

export const inventoryOutputUpdateSchema = inventoryOutputMutationSchema.extend({
  id: requiredId("Inventory output ID required"),
});

export const inventoryOutputDeleteSchema = z.object({
  id: requiredId("Inventory output ID required"),
});
