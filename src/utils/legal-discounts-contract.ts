import { z } from "zod";

const moneySchema = z.coerce
  .number()
  .finite()
  .min(0, "El valor no puede ser negativo.");

const percentageSchema = z.coerce
  .number()
  .finite()
  .min(0, "La tasa no puede ser negativa.")
  .max(100, "La tasa no puede superar 100%. ");

export const legalDiscountOperationTypeSchema = z.enum([
  "PURCHASE",
  "SERVICE",
  "FEE",
]);

export const legalDiscountCustomerProfileSchema = z.enum([
  "SMALL_CUSTOMER",
  "WITHHOLDING_AGENT",
  "LARGE_CONTRIBUTOR",
  "PUBLIC_ENTITY",
]);

export const legalDiscountsPreviewBodySchema = z.object({
  subtotal: moneySchema,
  ivaRate: percentageSchema.default(19),
  operationType: legalDiscountOperationTypeSchema,
  customerProfile: legalDiscountCustomerProfileSchema,
  reteFuenteRate: percentageSchema.optional(),
  reteIcaRate: percentageSchema.default(0.966),
  reteIvaRate: percentageSchema.default(15),
  stampRate: percentageSchema.default(1.5),
  applyReteIca: z.boolean().optional(),
  applyStamps: z.boolean().optional(),
  contractRequiresStamps: z.boolean().default(false),
});

export type LegalDiscountsPreviewBody = z.infer<
  typeof legalDiscountsPreviewBodySchema
>;
