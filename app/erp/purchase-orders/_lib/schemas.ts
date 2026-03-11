import { z } from "zod";

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid().optional(),
  bankId: z.string().uuid("Banco requerido"),
  bankAccountRef: z.string().trim().min(3, "Referencia bancaria requerida").max(80),
  notes: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid("Selecciona un item"),
        variantId: z.string().uuid().optional(),
        quantity: z
          .string()
          .trim()
          .min(1, "Cantidad requerida")
          .refine((v) => Number(v) > 0, "Cantidad debe ser mayor a 0"),
        unitPrice: z
          .string()
          .trim()
          .min(1, "Precio requerido")
          .refine((v) => Number(v) > 0, "Precio debe ser mayor a 0"),
      }),
    )
    .min(1, "Agrega al menos un item"),
});
