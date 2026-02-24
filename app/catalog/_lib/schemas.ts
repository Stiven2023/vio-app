import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(150, "Máximo 150"),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  description: z.string().optional(),
  categoryId: z.string().uuid("Selecciona una categoría"),
  priceCopR1: z
    .string()
    .trim()
    .min(1, "Precio base requerido")
    .refine((v) => !Number.isNaN(Number(v)), "Precio base inválido"),
  priceCopR2: z
    .string()
    .trim()
    .min(1, "Precio +499 requerido")
    .refine((v) => !Number.isNaN(Number(v)), "Precio +499 inválido"),
  priceCopR3: z
    .string()
    .trim()
    .min(1, "Precio +1000 requerido")
    .refine((v) => !Number.isNaN(Number(v)), "Precio +1000 inválido"),
  priceMayorista: z
    .string()
    .trim()
    .min(1, "Precio mayorista requerido")
    .refine((v) => !Number.isNaN(Number(v)), "Precio mayorista inválido"),
  priceColanta: z
    .string()
    .trim()
    .min(1, "Precio Colanta requerido")
    .refine((v) => !Number.isNaN(Number(v)), "Precio Colanta inválido"),
  priceViomar: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio Viomar inválido"),
  priceUSD: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio USD inválido"),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const createProductPriceSchema = z.object({
  productId: z.string().uuid("Selecciona un producto"),
  referenceCode: z
    .string()
    .trim()
    .min(1, "Código requerido")
    .max(50, "Máximo 50"),
  priceCopR1: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio R1 inválido"),
  priceCopR2: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio R2 inválido"),
  priceCopR3: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio R3 inválido"),
  priceViomar: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio Viomar inválido"),
  priceColanta: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio Colanta inválido"),
  priceMayorista: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio Mayorista inválido"),
  priceUSD: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio USD inválido"),
  isEditable: z.boolean().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(255, "Máximo 255"),
  unit: z.string().trim().min(1, "Unidad requerida").max(50, "Máximo 50"),
  description: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  price: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .refine((v) => !v || !Number.isNaN(Number(v)), "Precio inválido"),
  supplierId: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .refine((v) => !v || /^[0-9a-fA-F-]{36}$/.test(v), "Proveedor inválido"),
  minStock: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .refine((v) => !v || !Number.isNaN(Number(v)), "Stock mínimo inválido"),
  isActive: z.boolean().optional(),
});

export const createInventoryEntrySchema = z.object({
  inventoryItemId: z.string().uuid("Selecciona un item"),
  supplierId: z.string().uuid().optional(),
  location: z.enum(["BODEGA_PRINCIPAL", "TIENDA"]),
  quantity: z
    .string()
    .trim()
    .min(1, "Cantidad requerida")
    .refine((v) => Number(v) > 0, "Cantidad debe ser mayor a 0"),
});

export const createInventoryOutputSchema = z.object({
  inventoryItemId: z.string().uuid("Selecciona un item"),
  orderItemId: z.string().uuid().optional(),
  location: z.enum(["BODEGA_PRINCIPAL", "TIENDA"]),
  reason: z.string().trim().min(1, "Motivo requerido").max(100, "Máximo 100"),
  quantity: z
    .string()
    .trim()
    .min(1, "Cantidad requerida")
    .refine((v) => Number(v) > 0, "Cantidad debe ser mayor a 0"),
});
