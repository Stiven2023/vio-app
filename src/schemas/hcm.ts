import { z } from "zod";

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)");

// ── Employee self-service: leave request ──────────────────────────────────────

export const createLeaveSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: "La fecha final no puede ser anterior a la inicial",
    path: ["endDate"],
  })
  .refine(
    (d) => d.startDate >= new Date().toISOString().slice(0, 10),
    {
      message: "La fecha de inicio no puede ser en el pasado",
      path: ["startDate"],
    },
  );

// ── Employee self-service: petition / PQR ────────────────────────────────────

export const createPetitionSchema = z
  .object({
    type: z.enum(["PERMISO", "RECLAMO", "SOLICITUD", "SUGERENCIA", "PQR"], {
      errorMap: () => ({ message: "Tipo de petición inválido" }),
    }),
    subject: z.string().trim().min(1, "El asunto es requerido").max(255),
    description: z.string().trim().min(1, "La descripción es requerida").max(5000),
    requestDate: isoDate.optional(),
    requestHours: z.number().min(0.5).max(24).optional(),
    priority: z.enum(["BAJA", "MEDIA", "ALTA"]).default("MEDIA"),
  })
  .refine(
    (d) => d.type !== "PERMISO" || Boolean(d.requestDate),
    {
      message: "Para permisos la fecha es requerida",
      path: ["requestDate"],
    },
  );

// ── HR admin: resolve petition ────────────────────────────────────────────────

export const resolvePetitionSchema = z.object({
  status: z.enum(
    ["PENDIENTE", "APROBADO", "RECHAZADO", "EN_REVISION", "CERRADO"],
    { errorMap: () => ({ message: "Estado inválido" }) },
  ),
  responseNotes: z.string().trim().max(2000).optional(),
});
