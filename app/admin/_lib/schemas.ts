import { z } from "zod";

const passwordSchema = z
  .string()
  .min(7, "Mínimo 7 caracteres")
  .regex(/[A-Z]/, "Debe incluir al menos 1 mayúscula")
  .regex(/^[A-Za-z0-9.*]+$/, "Solo letras, números, . y *");

export const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
});

export const nameSchema = z.object({ name: z.string().trim().min(1, "Nombre requerido") });

export const createEmployeeSchema = z.object({
  userId: z.string().uuid("Selecciona un usuario"),
  name: z.string().trim().min(1, "Nombre requerido"),
  roleId: z.string().uuid("Selecciona un rol"),
  isActive: z.boolean().optional(),
});

export const createRolePermissionSchema = z.object({
  roleId: z.string().uuid("Selecciona un rol"),
  permissionId: z.string().uuid("Selecciona un permiso"),
});
