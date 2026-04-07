import { z } from "zod";

export const messengerTypeSchema = z.enum(["MENSAJERO", "CONDUCTOR"]);
export const vehicleTypeValues = [
  "MOTO",
  "AUTOMOVIL",
  "CAMIONETA",
  "FURGON",
  "CAMION",
  "BICICLETA",
  "OTRO",
] as const;
export const vehicleTypeSchema = z.enum(vehicleTypeValues);

const optionalDateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD.")
  .nullable()
  .optional();

const optionalVehiclePlate = z
  .string()
  .trim()
  .transform((value) => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
  .refine(
    (value) =>
      value.length === 0 || /^(?:[A-Z]{3}\d{3}|[A-Z]{3}\d{2}[A-Z])$/.test(value),
    "La placa debe tener formato ABC123 o ABC12D.",
  )
  .nullable()
  .optional();

const optionalVehicleType = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => value.length === 0 || vehicleTypeValues.includes(value as (typeof vehicleTypeValues)[number]),
    "Tipo de vehículo inválido.",
  )
  .nullable()
  .optional();

const messengerBaseSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  identificationType: z.enum(["CC", "NIT", "CE", "PAS", "EMPRESA_EXTERIOR"]),
  identification: z.string().trim().min(1, "La identificación es obligatoria."),
  address: z.string().trim().min(1, "La dirección es obligatoria."),
  messengerType: messengerTypeSchema,
  vehicleType: optionalVehicleType,
  vehiclePlate: optionalVehiclePlate,
  drivingLicenseUrl: z.string().trim().max(500).nullable().optional(),
  drivingLicenseExpiresAt: optionalDateOnly,
  soatDocumentUrl: z.string().trim().max(500).nullable().optional(),
  soatDocumentExpiresAt: optionalDateOnly,
  tecnomecanicaDocumentUrl: z.string().trim().max(500).nullable().optional(),
  tecnomecanicaDocumentExpiresAt: optionalDateOnly,
  vehicleLicenseDocumentUrl: z.string().trim().max(500).nullable().optional(),
  vehicleLicenseDocumentExpiresAt: optionalDateOnly,
  email: z.string().trim().email().nullable().optional(),
  mobile: z.string().trim().max(20).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

type DocumentExpiryFields = {
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  drivingLicenseUrl?: string | null;
  drivingLicenseExpiresAt?: string | null;
  soatDocumentUrl?: string | null;
  soatDocumentExpiresAt?: string | null;
  tecnomecanicaDocumentUrl?: string | null;
  tecnomecanicaDocumentExpiresAt?: string | null;
  vehicleLicenseDocumentUrl?: string | null;
  vehicleLicenseDocumentExpiresAt?: string | null;
};

function withDocumentExpiryValidation<T extends z.ZodType<DocumentExpiryFields>>(schema: T) {
  return schema.superRefine((value, ctx) => {
    if (String(value.vehiclePlate ?? "").trim() && !String(value.vehicleType ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vehicleType"],
        message: "Debes seleccionar el tipo de vehículo cuando registras una placa.",
      });
    }

    const pairs = [
      {
        url: value.drivingLicenseUrl,
        expiresAt: value.drivingLicenseExpiresAt,
        field: "drivingLicenseExpiresAt",
        message: "Debes indicar el vencimiento de la licencia de conducción.",
      },
      {
        url: value.soatDocumentUrl,
        expiresAt: value.soatDocumentExpiresAt,
        field: "soatDocumentExpiresAt",
        message: "Debes indicar el vencimiento del SOAT.",
      },
      {
        url: value.tecnomecanicaDocumentUrl,
        expiresAt: value.tecnomecanicaDocumentExpiresAt,
        field: "tecnomecanicaDocumentExpiresAt",
        message: "Debes indicar el vencimiento de la tecnomecánica.",
      },
      {
        url: value.vehicleLicenseDocumentUrl,
        expiresAt: value.vehicleLicenseDocumentExpiresAt,
        field: "vehicleLicenseDocumentExpiresAt",
        message: "Debes indicar el vencimiento de la licencia del vehículo.",
      },
    ] as const;

    for (const pair of pairs) {
      if (String(pair.url ?? "").trim() && !String(pair.expiresAt ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [pair.field],
          message: pair.message,
        });
      }
    }
  });
}

export const createMessengerSchema = withDocumentExpiryValidation(messengerBaseSchema);

export const updateMessengerSchema = withDocumentExpiryValidation(messengerBaseSchema.partial()).extend({
  id: z.string().trim().min(1, "El id es obligatorio."),
});

export const deleteMessengerSchema = z.object({
  id: z.string().trim().min(1, "El id es obligatorio."),
});
