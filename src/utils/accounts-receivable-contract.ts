import { z } from "zod";

const paymentTypeValues = ["CASH", "CREDIT"] as const;
const agingBucketValues = ["CURRENT", "1_30", "31_60", "61_90", "90_PLUS"] as const;
const creditBackingTypeValues = [
  "PROMISSORY_NOTE",
  "PURCHASE_ORDER",
  "VERBAL_AGREEMENT",
] as const;

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido (YYYY-MM-DD).");

const paginationNumericSchema = z
  .string()
  .regex(/^\d+$/, "Debe ser un numero entero positivo.");

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();

  return trimmed.length ? trimmed : undefined;
}

export const accountsReceivableQuerySchema = z
  .object({
    paymentType: z.enum(paymentTypeValues).optional(),
    clientId: z.preprocess(
      emptyToUndefined,
      z.string().uuid("ID de cliente invalido.").optional(),
    ),
    dateFrom: z.preprocess(emptyToUndefined, dateOnlySchema.optional()),
    dateTo: z.preprocess(emptyToUndefined, dateOnlySchema.optional()),
    agingBucket: z.preprocess(
      emptyToUndefined,
      z.enum(agingBucketValues).optional(),
    ),
    creditBackingType: z.preprocess(
      emptyToUndefined,
      z.enum(creditBackingTypeValues).optional(),
    ),
    page: z.preprocess(emptyToUndefined, paginationNumericSchema.optional()),
    pageSize: z.preprocess(emptyToUndefined, paginationNumericSchema.optional()),
  })
  .superRefine((value, ctx) => {
    if (!value.dateFrom || !value.dateTo) return;

    const from = new Date(`${value.dateFrom}T00:00:00.000Z`);
    const to = new Date(`${value.dateTo}T00:00:00.000Z`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return;

    if (from.getTime() > to.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "La fecha final no puede ser menor a la fecha inicial.",
      });
    }
  });

export type AccountsReceivableQuery = z.infer<typeof accountsReceivableQuerySchema>;
