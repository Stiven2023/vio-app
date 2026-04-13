import { z } from "zod";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido (YYYY-MM-DD)");

const uuidOrEmptySchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .pipe(z.string().uuid().optional());

export const perDiemExpenseTypeSchema = z.enum([
  "HOTEL",
  "TRAVEL",
  "MEALS",
  "OTHER",
]);

export const createPerDiemSchema = z
  .object({
    supportInvoiceUrl: z.string().trim().url("La URL del soporte es invalida."),
    supportInvoiceNumber: z.string().trim().max(60).optional(),
    amount: z.coerce
      .number()
      .finite()
      .positive("El valor debe ser mayor a cero."),
    expenseType: perDiemExpenseTypeSchema,
    tripStartDate: isoDateSchema,
    tripEndDate: isoDateSchema,
    purchaseOrderId: uuidOrEmptySchema,
    supplierInvoiceId: uuidOrEmptySchema,
    notes: z.string().trim().max(1500).optional(),
  })
  .refine((data) => data.tripStartDate <= data.tripEndDate, {
    message: "La fecha final del viaje no puede ser menor a la inicial.",
    path: ["tripEndDate"],
  });

export const perDiemListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePerDiemInput = z.infer<typeof createPerDiemSchema>;
