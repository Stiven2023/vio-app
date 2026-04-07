import { z } from "zod";

const positiveNumber = z
  .union([z.number(), z.string()])
  .transform((value) => Number(String(value).trim()))
  .refine((value) => Number.isFinite(value) && value > 0, {
    message: "quantity must be positive",
  });

const requiredId = (fieldMessage: string) =>
  z.string({ message: fieldMessage }).trim().min(1, fieldMessage);

export const warehouseTransferCreateSchema = z
  .object({
    inventoryItemId: requiredId("inventoryItemId required"),
    variantId: requiredId("variantId required"),
    fromWarehouseId: requiredId("fromWarehouseId required"),
    toWarehouseId: requiredId("toWarehouseId required"),
    quantity: positiveNumber,
    notes: z.string().optional().nullable().default(""),
    isRequest: z.boolean().optional().default(false),
    requesterCode: z.string().optional().nullable().default(""),
  })
  .superRefine((payload, ctx) => {
    if (payload.fromWarehouseId === payload.toWarehouseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toWarehouseId"],
        message: "source and destination must be different",
      });
    }
  });

export const warehouseTransferListQuerySchema = z.object({
  warehouseId: requiredId("warehouseId required"),
  scope: z
    .union([z.literal("incoming"), z.literal("outgoing")])
    .optional()
    .default("incoming"),
  status: z
    .union([z.literal("pending"), z.literal("resolved")])
    .optional()
    .default("pending"),
});

export const warehouseTransferActionSchema = z.object({
  id: requiredId("id required"),
  notes: z.string().optional().nullable().default(""),
});

export const warehouseTransferDeleteSchema = z.object({
  id: requiredId("id required"),
});

export function toPositiveNumber(v: unknown) {
  const n = Number(String(v));

  return Number.isFinite(n) && n > 0 ? n : null;
}
