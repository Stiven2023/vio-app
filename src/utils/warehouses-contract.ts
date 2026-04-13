import { z } from "zod";

const warehousePurposeValues = [
  "GENERAL",
  "PRINCIPAL",
  "MATERIA_PRIMA",
  "PRODUCCION",
  "TIENDA",
  "MUESTRAS",
  "INSUMOS",
  "PRODUCTO_TERMINADO",
  "TRANSITO",
] as const;

export const warehousePurposeSchema = z.enum(warehousePurposeValues);

const booleanWithDefault = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") return defaultValue;
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;

      const normalized = String(value).trim().toLowerCase();
      if (["true", "1", "yes", "si", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;

      return defaultValue;
    });

const trimToNullable = (max = 200) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      const normalized = String(value ?? "").trim();
      if (!normalized) return null;
      return normalized.slice(0, max);
    });

export const warehouseMutationSchema = z.object({
  code: z
    .string({ message: "Code is required." })
    .trim()
    .min(1, "Code is required.")
    .max(120, "Code is too long."),
  name: z
    .string({ message: "Name is required." })
    .trim()
    .min(1, "Name is required.")
    .max(120, "Name is too long."),
  description: trimToNullable(500),
  purpose: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => String(value ?? "").trim().toUpperCase())
    .transform((value) =>
      warehousePurposeValues.includes(value as (typeof warehousePurposeValues)[number])
        ? (value as (typeof warehousePurposeValues)[number])
        : "GENERAL",
    ),
  isVirtual: booleanWithDefault(false),
  isExternal: booleanWithDefault(false),
  address: trimToNullable(200),
  city: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => String(value ?? "").trim() || "Medellin"),
  department: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => String(value ?? "").trim() || "ANTIOQUIA"),
  isActive: booleanWithDefault(true),
});

export const warehouseIdSchema = z.object({
  id: z.string({ message: "id is required" }).trim().min(1, "id is required"),
});

export function normalizeWarehouseCode(raw: string) {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_")
    .slice(0, 30);
}
