import { z } from "zod";

export const orderHistoryParamsSchema = z.object({
  id: z.string().uuid("El id del pedido debe ser un UUID válido."),
});

export const accountingEntrySourceByIdParamsSchema = z.object({
  id: z.string().uuid("El id del asiento debe ser un UUID válido."),
});

export const orderByPaymentParamsSchema = z.object({
  paymentId: z.string().uuid("El id del pago debe ser un UUID válido."),
});

export const accountingEntriesBySourceQuerySchema = z.object({
  sourceType: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "sourceType es obligatorio."),
  sourceId: z.string().trim().min(1, "sourceId es obligatorio."),
  status: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value === "" ||
        value === "POSTED" ||
        value === "DRAFT" ||
        value === "REVERSED",
      "status debe ser POSTED, DRAFT o REVERSED.",
    ),
});
