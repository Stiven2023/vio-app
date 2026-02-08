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
