import { z } from "zod";

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid("Selecciona un item"),
        quantity: z
          .string()
          .trim()
          .min(1, "Cantidad requerida")
          .refine((v) => Number(v) > 0, "Cantidad debe ser mayor a 0"),
      }),
    )
    .min(1, "Agrega al menos un item"),
});
