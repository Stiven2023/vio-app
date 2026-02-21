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

export const nameSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
});

export const createEmployeeSchema = z
  .object({
    userId: z.string().uuid("Usuario inválido").optional(),
    name: z.string().trim().min(1, "Nombre requerido"),
    identificationType: z.enum([
      "CC",
      "NIT",
      "CE",
      "PAS",
      "EMPRESA_EXTERIOR",
    ]),
    identification: z
      .string()
      .trim()
      .min(1, "Identificación requerida")
      .max(20, "Máximo 20 caracteres"),
    dv: z.string().trim().max(1).optional(),
    email: z.string().trim().email("Email inválido"),
    intlDialCode: z
      .string()
      .trim()
      .regex(/^\+?\d{1,4}$/, "Código internacional inválido")
      .optional(),
    mobile: z.string().trim().optional(),
    landline: z.string().trim().optional(),
    extension: z
      .string()
      .trim()
      .regex(/^\d{1,6}$/, "Extensión inválida")
      .optional(),
    address: z.string().trim().optional(),
    city: z.string().trim().optional(),
    department: z.string().trim().optional(),
    roleId: z.string().uuid("Selecciona un rol").optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const identification = data.identification.trim();

    if (data.identificationType === "CC" && !/^\d{6,10}$/.test(identification)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identification"],
        message: "La CC debe tener entre 6 y 10 dígitos",
      });
    }

    if (
      data.identificationType === "NIT" &&
      !/^\d{8,12}$/.test(identification)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identification"],
        message: "El NIT debe tener entre 8 y 12 dígitos",
      });
    }

    if (data.identificationType === "CE" && !/^[A-Za-z0-9]{5,15}$/.test(identification)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identification"],
        message: "La CE debe tener entre 5 y 15 caracteres alfanuméricos",
      });
    }

    if (
      data.identificationType === "PAS" &&
      !/^[A-Za-z0-9]{5,20}$/.test(identification)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identification"],
        message: "El pasaporte debe tener entre 5 y 20 caracteres alfanuméricos",
      });
    }

    if (
      data.identificationType === "EMPRESA_EXTERIOR" &&
      identification.length < 3
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identification"],
        message: "La identificación de empresa exterior debe tener al menos 3 caracteres",
      });
    }

    if (data.mobile?.trim()) {
      const mobileDigits = data.mobile.replace(/\D/g, "");
      if (mobileDigits.length < 7 || mobileDigits.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mobile"],
          message: "El móvil debe tener entre 7 y 15 dígitos",
        });
      }
    }
  });

export const createRolePermissionSchema = z.object({
  roleId: z.string().uuid("Selecciona un rol"),
  permissionId: z.string().uuid("Selecciona un permiso"),
});

export const createClientSchema = z
  .object({
    // --- TIPO DE CLIENTE (automático según selección) ---
    clientType: z.enum(["NACIONAL", "EXTRANJERO", "EMPLEADO"]),
    
    // --- IDENTIFICACIÓN Y DOCUMENTOS (tipo de documento determina documentos requeridos) ---
    // Aceptar URLs HTTP(s) o rutas locales (/documents/...)
    identityDocumentUrl: z
      .string()
      .trim()
      .refine(
        (val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/documents/"),
        "Debe ser una URL válida o ruta local"
      )
      .optional(),
    rutDocumentUrl: z
      .string()
      .trim()
      .refine(
        (val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/documents/"),
        "Debe ser una URL válida o ruta local"
      )
      .optional(),
    commerceChamberDocumentUrl: z
      .string()
      .trim()
      .refine(
        (val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/documents/"),
        "Debe ser una URL válida o ruta local"
      )
      .optional(),
    passportDocumentUrl: z
      .string()
      .trim()
      .refine(
        (val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/documents/"),
        "Debe ser una URL válida o ruta local"
      )
      .optional(),
    taxCertificateDocumentUrl: z
      .string()
      .trim()
      .refine(
        (val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/documents/"),
        "Debe ser una URL válida o ruta local"
      )
      .optional(),
    companyIdDocumentUrl: z
      .string()
      .trim()
      .refine(
        (val) => val.startsWith("http://") || val.startsWith("https://") || val.startsWith("/documents/"),
        "Debe ser una URL válida o ruta local"
      )
      .optional(),

    // --- CAMPOS CRÍTICOS REQUERIDOS ---
    name: z.string().trim().min(1, "Nombre requerido"),
    priceClientType: z.enum(["AUTORIZADO", "MAYORISTA", "VIOMAR", "COLANTA"]),
    identificationType: z.enum([
      "CC",
      "NIT",
      "CE",
      "PAS",
      "EMPRESA_EXTERIOR",
    ]),
    identification: z
      .string()
      .trim()
      .min(1, "Identificación requerida")
      .max(20, "Máximo 20 caracteres"),
    taxRegime: z.enum([
      "REGIMEN_COMUN",
      "REGIMEN_SIMPLIFICADO",
      "NO_RESPONSABLE",
    ]),
    contactName: z.string().trim().min(1, "Nombre de contacto requerido"),
    email: z
      .string()
      .trim()
      .transform((val) => val || undefined)
      .pipe(
        z
          .string()
          .refine(
            (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
            "Email inválido"
          )
          .optional()
      ),
    address: z.string().trim().min(1, "Dirección requerida"),

    // --- CAMPOS OPCIONALES ---
    dv: z.string().trim().max(1).optional(),
    branch: z.string().trim().max(10).optional(),
    postalCode: z.string().trim().optional(),
    country: z.string().trim().optional(),
    department: z.string().trim().optional(),
    city: z.string().trim().optional(),

    // --- TELÉFONOS (MÓVIL ES CRÍTICO) ---
    intlDialCode: z
      .string()
      .trim()
      .regex(/^\+?\d{1,4}$/, "Código internacional inválido")
      .optional(),
    mobile: z.string().trim().min(1, "Móvil requerido"),
    localDialCode: z
      .string()
      .trim()
      .regex(/^\d{1,5}$/, "Código local inválido")
      .optional(),
    landline: z.string().trim().optional(),
    extension: z
      .string()
      .trim()
      .regex(/^\d{1,6}$/, "Extensión inválida")
      .optional(),

    // --- CRÉDITO ---
    hasCredit: z.boolean().optional(),
    promissoryNoteNumber: z.string().trim().optional(),
    promissoryNoteDate: z.string().optional(),

    status: z.enum(["ACTIVO", "INACTIVO", "SUSPENDIDO"]).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const identification = data.identification.trim();

    if (data.identificationType === "CC" && !/^\d{6,10}$/.test(identification)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identification"],
        message: "La CC debe tener entre 6 y 10 dígitos",
      });
    }

    if (
      data.identificationType === "NIT" &&
      !/^\d{8,12}$/.test(identification)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identification"],
        message: "El NIT debe tener entre 8 y 12 dígitos",
      });
    }

    if (data.identificationType === "CE" && !/^[A-Za-z0-9]{5,15}$/.test(identification)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identification"],
        message: "La CE debe tener entre 5 y 15 caracteres alfanuméricos",
      });
    }

    if (
      data.identificationType === "PAS" &&
      !/^[A-Za-z0-9]{5,20}$/.test(identification)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identification"],
        message: "El pasaporte debe tener entre 5 y 20 caracteres alfanuméricos",
      });
    }

    if (
      data.identificationType === "EMPRESA_EXTERIOR" &&
      identification.length < 3
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identification"],
        message: "La identificación de empresa exterior debe tener al menos 3 caracteres",
      });
    }

    const mobileDigits = data.mobile.replace(/\D/g, "");
    if (mobileDigits.length < 7 || mobileDigits.length > 15) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mobile"],
        message: "El móvil debe tener entre 7 y 15 dígitos",
      });
    }

    if (data.landline) {
      const landlineDigits = data.landline.replace(/\D/g, "");
      if (landlineDigits.length < 6 || landlineDigits.length > 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["landline"],
          message: "El teléfono fijo debe tener entre 6 y 12 dígitos",
        });
      }
    }

    if (data.hasCredit) {
      if (!data.promissoryNoteNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["promissoryNoteNumber"],
          message: "Número de pagaré requerido cuando hay crédito",
        });
      }

      if (!data.promissoryNoteDate?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["promissoryNoteDate"],
          message: "Fecha de pagaré requerida cuando hay crédito",
        });
      }
    }
  });
