import { z } from "zod";

import {
  legalDiscountCustomerProfileSchema,
  legalDiscountOperationTypeSchema,
} from "@/src/utils/legal-discounts-contract";

const moneySchema = z.coerce
  .number()
  .finite()
  .min(0, "El valor no puede ser negativo.");

const percentageSchema = z.coerce
  .number()
  .finite()
  .min(0, "La tasa no puede ser negativa.")
  .max(100, "La tasa no puede superar 100%.");

/**
 * Schema para crear una factura de proveedor.
 *
 * NUEVO: Se pueden proporcionar operationType y customerProfile para que
 * el motor de descuentos legales calcule automáticamente los tributos.
 *
 * Si operationType y customerProfile están presentes:
 *   - ivaAmount, withholdingTax, withholdingIva, withholdingIca serán calculados
 *   - Si el usuario intenta pasarlos, serán ignorados
 *
 * Si operationType/customerProfile NO están presentes:
 *   - Los campos tributarios deben ser proporcionados por el usuario (compatibilidad atrás)
 */
export const createSupplierInvoiceSchema = z
  .object({
    supplierId: z.string().uuid("ID de proveedor inválido."),
    purchaseOrderId: z.string().uuid("ID de orden de compra inválido."),
    purchaseOrderReceiptId: z
      .string()
      .uuid("ID de recibo de compra inválido.")
      .optional()
      .nullable(),
    supplierInvoiceNumber: z
      .string()
      .min(1, "Número de factura requerido.")
      .max(100)
      .optional()
      .nullable(),
    invoiceDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Formato de fecha inválido (YYYY-MM-DD)."
      )
      .refine(
        (dateStr) => !Number.isNaN(Date.parse(dateStr)),
        "Fecha inválida."
      ),
    dueDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Formato de fecha inválido (YYYY-MM-DD)."
      )
      .refine(
        (dateStr) => !Number.isNaN(Date.parse(dateStr)),
        "Fecha inválida."
      )
      .optional()
      .nullable(),
    currency: z
      .enum(["COP", "USD", "EUR"])
      .default("COP"),
    subtotal: moneySchema.gt(0, "Subtotal debe ser mayor a cero."),

    // ── Cálculo de tributos ──────────────────────────────────────────
    // OPCIÓN A: Motor automático (operationType + customerProfile)
    operationType: legalDiscountOperationTypeSchema
      .optional(),
    customerProfile: legalDiscountCustomerProfileSchema
      .optional(),
    ivaRate: percentageSchema
      .default(19)
      .optional(),

    // OPCIÓN B: Manualmente (valores individuales)
    ivaAmount: moneySchema
      .optional(),
    withholdingTax: moneySchema
      .default(0),
    withholdingIva: moneySchema
      .default(0),
    withholdingIca: moneySchema
      .default(0),

    notes: z
      .string()
      .max(1000)
      .optional()
      .nullable(),
    documentUrl: z
      .string()
      .url("URL del documento inválida.")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      // Si se proporciona operationType, customerProfile debe estar también
      if (data.operationType && !data.customerProfile) {
        return false;
      }
      // Si se proporciona customerProfile, operationType debe estar también
      if (data.customerProfile && !data.operationType) {
        return false;
      }
      return true;
    },
    {
      message:
        "Si se proporciona operationType, customerProfile es obligatorio (y viceversa).",
      path: ["customerProfile"],
    }
  );

export type CreateSupplierInvoiceInput = z.infer<
  typeof createSupplierInvoiceSchema
>;

/**
 * Schema para el query de listado de facturas de proveedor.
 */
export const supplierInvoiceListQuerySchema = z.object({
  status: z
    .enum([
      "RECIBIDA",
      "APROBADA",
      "CONTABILIZADA",
      "PAGADA",
      "CANCELADA",
      "RECHAZADA",
    ])
    .optional(),
  supplierId: z.string().uuid().optional(),
  page: z.coerce
    .number()
    .int()
    .min(1, "Página debe ser >= 1")
    .default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, "pageSize debe ser >= 1")
    .max(100, "pageSize máximo 100")
    .default(20),
});

export type SupplierInvoiceListQuery = z.infer<
  typeof supplierInvoiceListQuerySchema
>;
