import { z } from "zod";

const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const hhmmRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const moneyField = z
  .union([z.number(), z.string()])
  .transform((value) => Number(String(value).trim()))
  .refine((value) => Number.isFinite(value) && value >= 0, {
    message: "Debe ser un valor monetario valido (>= 0).",
  });

export const hcmLiquidarColillaSchema = z.object({
  employeeId: z.string().trim().min(1, "El employeeId es obligatorio."),
  period: z
    .string()
    .trim()
    .regex(periodRegex, "El periodo debe tener formato YYYY-MM."),
  salarioBase: moneyField,
  horasExtrasValor: moneyField.optional().default(0),
  comisiones: moneyField.optional().default(0),
  bonificaciones: moneyField.optional().default(0),
  vacacionesDisfrutadas: moneyField.optional().default(0),
  embargos: moneyField.optional().default(0),
  libranzas: moneyField.optional().default(0),
  claseRiesgoARL: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  bankId: z.string().trim().optional(),
  generadoPor: z.string().trim().min(1, "El generadoPor es obligatorio."),
});

export const hcmSolicitudHoraExtraSchema = z
  .object({
    employeeId: z.string().trim().min(1, "El employeeId es obligatorio."),
    supervisorId: z.string().trim().min(1, "El supervisorId es obligatorio."),
    fecha: z
      .string()
      .trim()
      .regex(dateRegex, "La fecha debe tener formato YYYY-MM-DD."),
    horaInicio: z.string().trim().regex(hhmmRegex, "Hora inicio invalida."),
    horaFin: z.string().trim().regex(hhmmRegex, "Hora fin invalida."),
    tipo: z.enum([
      "DIURNA_ORDINARIA",
      "NOCTURNA_ORDINARIA",
      "DOMINICAL_DIURNA",
      "DOMINICAL_NOCTURNA",
      "FESTIVO_DIURNO",
      "FESTIVO_NOCTURNO",
    ]),
    totalHoras: z
      .union([z.number(), z.string()])
      .transform((value) => Number(String(value).trim()))
      .refine((value) => Number.isFinite(value) && value > 0, {
        message: "totalHoras debe ser mayor a 0.",
      }),
    actividad: z
      .string()
      .trim()
      .min(5, "Describe la actividad (minimo 5 caracteres)."),
    orderItemId: z.string().trim().optional(),
    employeeRequestId: z.string().trim().optional(),
    period: z
      .string()
      .trim()
      .regex(periodRegex, "El periodo debe tener formato YYYY-MM.")
      .optional(),
  })
  .superRefine((value, ctx) => {
    const start = value.horaInicio;
    const end = value.horaFin;

    if (start >= end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["horaFin"],
        message: "La hora fin debe ser mayor que la hora inicio.",
      });
    }
  });

export const hcmColillasQuerySchema = z.object({
  period: z
    .string()
    .trim()
    .regex(periodRegex, "El periodo debe tener formato YYYY-MM.")
    .optional(),
  status: z
    .enum(["BORRADOR", "LIQUIDADA", "PAGADA", "CONTABILIZADA"])
    .optional(),
});

export const hcmCertificados220QuerySchema = z.object({
  vigenciaFiscal: z
    .union([z.number(), z.string()])
    .transform((value) => Number(String(value).trim()))
    .refine(
      (value) => Number.isInteger(value) && value >= 2000 && value <= 2100,
      {
        message: "La vigencia fiscal es invalida.",
      },
    )
    .optional(),
});

export const hcmCartaLaboralCreateSchema = z.object({
  tipo: z.enum([
    "LABORAL_GENERAL",
    "LABORAL_BANCO",
    "LABORAL_VISA",
    "INGRESO_SALARIO",
    "RETIRO",
    "PAZ_Y_SALVO",
  ]),
  destinatario: z.string().trim().max(255).optional(),
  proposito: z.string().trim().max(2000).optional(),
});

export const hcmHorasExtrasListQuerySchema = z.object({
  period: z
    .string()
    .trim()
    .regex(periodRegex, "El periodo debe tener formato YYYY-MM.")
    .optional(),
  status: z
    .enum(["PENDIENTE", "EN_REVISION", "APROBADO", "RECHAZADO", "RESUELTO"])
    .optional(),
  fecha: z
    .string()
    .trim()
    .regex(dateRegex, "La fecha debe tener formato YYYY-MM-DD.")
    .optional(),
});

export const hcmIdParamSchema = z.object({
  id: z.string().trim().min(1, "El id es obligatorio."),
});

export const hcmEmployeeParamSchema = z.object({
  employeeId: z.string().trim().min(1, "El employeeId es obligatorio."),
});

export const hcmHoraExtraAprobarParamsSchema = hcmIdParamSchema;

export const hcmHoraExtraAprobarBodySchema = z.object({
  aprobar: z.boolean().optional().default(true),
  motivoRechazo: z.string().trim().max(2000).optional(),
});

export const hcmPortalParamsSchema = hcmEmployeeParamSchema;

export const hcmNotificacionParamsSchema = hcmIdParamSchema;

export const hcmNotificacionesQuerySchema = z.object({
  leida: z.enum(["true", "false"]).optional(),
});

export const hcmInscripcionFormacionParamsSchema = hcmIdParamSchema;

export const hcmDisponibilidadQuerySchema = z.object({
  fecha: z
    .string()
    .trim()
    .regex(dateRegex, "La fecha debe tener formato YYYY-MM-DD."),
});

export const hcmPreAsientosContabilizarSchema = z.object({
  preAsientoIds: z
    .array(z.string().trim().min(1, "El id del pre-asiento es obligatorio."))
    .min(1, "Debes enviar al menos un pre-asiento."),
});

export const hcmCrearCartaSchema = hcmCartaLaboralCreateSchema;

export const hcmContabilizarPreAsientosSchema =
  hcmPreAsientosContabilizarSchema;

export type HcmLiquidarColillaInput = z.infer<typeof hcmLiquidarColillaSchema>;
export type HcmSolicitudHoraExtraInput = z.infer<
  typeof hcmSolicitudHoraExtraSchema
>;
export type HcmContabilizarPreAsientosInput = z.infer<
  typeof hcmContabilizarPreAsientosSchema
>;
