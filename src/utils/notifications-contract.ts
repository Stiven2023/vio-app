import { z } from "zod";

import { roleValues } from "@/src/db/enums";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD).");

const numericStringSchema = z
  .string()
  .regex(/^\d+$/, "Debe ser un número entero positivo.");

export const notificationsQuerySchema = z
  .object({
    page: numericStringSchema.optional(),
    pageSize: numericStringSchema.optional(),
    role: z.enum(roleValues).optional(),
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.optional(),
    unreadOnly: z.enum(["1", "0", "true", "false"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.startDate || !value.endDate) return;

    const start = new Date(`${value.startDate}T00:00:00.000Z`);
    const end = new Date(`${value.endDate}T00:00:00.000Z`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

    if (start.getTime() > end.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "La fecha final no puede ser menor a la fecha inicial.",
      });
    }
  });

export const notificationsBulkPatchSchema = z
  .object({
    ids: z
      .array(z.string().uuid("ID de notificación inválido."))
      .max(500, "Máximo 500 IDs por solicitud.")
      .optional(),
  })
  .strict();

export const notificationParamsSchema = z.object({
  id: z.string().uuid("ID de notificación inválido."),
});

export function isUnreadOnly(unreadOnly?: string) {
  return unreadOnly === "1" || unreadOnly === "true";
}