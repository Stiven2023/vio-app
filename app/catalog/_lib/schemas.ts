import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(150, "Máximo 150"),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  description: z.string().optional(),
  categoryId: z.string().uuid("Selecciona una categoría").optional(),
  isActive: z.boolean().optional(),
  isSet: z.boolean().optional(),
  productionType: z
    .enum(["SUBLIMADO", "CORTE_MANUAL"])
    .optional()
    .or(z.literal("" as any).transform(() => undefined)),
});

export const createProductPriceSchema = z.object({
  productId: z.string().uuid("Selecciona un producto"),
  referenceCode: z
    .string()
    .trim()
    .min(1, "Código requerido")
    .max(50, "Máximo 50"),
  priceCOP: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio COP inválido"),
  priceUSD: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio USD inválido"),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(255, "Máximo 255"),
  unit: z.string().trim().min(1, "Unidad requerida").max(50, "Máximo 50"),
});

export const createInventoryEntrySchema = z.object({
  inventoryItemId: z.string().uuid("Selecciona un item"),
  supplierId: z.string().uuid().optional(),
  quantity: z
    .string()
    .trim()
    .min(1, "Cantidad requerida")
    .refine((v) => Number(v) > 0, "Cantidad debe ser mayor a 0"),
});

export const createInventoryOutputSchema = z.object({
  inventoryItemId: z.string().uuid("Selecciona un item"),
  orderItemId: z.string().uuid().optional(),
  reason: z.string().trim().min(1, "Motivo requerido").max(100, "Máximo 100"),
  quantity: z
    .string()
    .trim()
    .min(1, "Cantidad requerida")
    .refine((v) => Number(v) > 0, "Cantidad debe ser mayor a 0"),
});
