import { z } from "zod";

export const messengerTypeSchema = z.enum(["MENSAJERO", "CONDUCTOR"]);

export const createMessengerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  identificationType: z.enum(["CC", "NIT", "CE", "PAS", "EMPRESA_EXTERIOR"]),
  identification: z.string().trim().min(1, "La identificación es obligatoria."),
  address: z.string().trim().min(1, "La dirección es obligatoria."),
  messengerType: messengerTypeSchema,
  vehicleType: z.string().trim().max(50).nullable().optional(),
  vehiclePlate: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  mobile: z.string().trim().max(20).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateMessengerSchema = createMessengerSchema.partial().extend({
  id: z.string().trim().min(1, "El id es obligatorio."),
});

export const deleteMessengerSchema = z.object({
  id: z.string().trim().min(1, "El id es obligatorio."),
});
