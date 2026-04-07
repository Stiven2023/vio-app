import { z } from "zod";

const requiredId = (message: string) =>
  z.string({ message }).trim().min(1, message);

const positiveQuantity = z
  .union([z.number(), z.string()])
  .transform((value) => Number(String(value).trim()))
  .refine((value) => Number.isFinite(value) && value > 0, {
    message: "quantity must be positive",
  });

export const inventoryLocationSchema = z.union([
  z.literal("BODEGA_PRINCIPAL"),
  z.literal("TIENDA"),
]);

export const inventoryEntryReasonSchema = z.union([
  z.literal("COMPRA_PROVEEDOR"),
  z.literal("DEVOLUCION_CLIENTE"),
  z.literal("AJUSTE_INVENTARIO"),
  z.literal("DEVOLUCION_PROVEEDOR"),
  z.literal("OTRO"),
]);

export const inventoryEntryCreateSchema = z.object({
  inventoryItemId: requiredId("inventoryItemId required"),
  variantId: requiredId("variantId required"),
  warehouseId: z.string().optional().nullable().default(""),
  location: inventoryLocationSchema.optional(),
  quantity: positiveQuantity,
  reason: inventoryEntryReasonSchema.optional().default("COMPRA_PROVEEDOR"),
  supplierId: z.string().optional().nullable().default(""),
});

export const inventoryEntryUpdateSchema = inventoryEntryCreateSchema.extend({
  id: requiredId("Inventory entry ID required"),
});

export const inventoryEntryDeleteSchema = z.object({
  id: requiredId("Inventory entry ID required"),
});
