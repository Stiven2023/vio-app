import { apiJson } from "@/app/admin/_lib/api";
import { z } from "zod";

const legalStatusSchema = z.object({
  status: z.enum(["VIGENTE", "EN_REVISION", "BLOQUEADO"], {
    message: "Estado jurídico inválido",
  }),
  notes: z.string().trim().optional(),
  reviewedBy: z.string().trim().optional(),
});

export type LegalStatusUpdate = z.infer<typeof legalStatusSchema>;

export type EmployeeLegalStatusCheck = {
  status: "VIGENTE" | "EN_REVISION" | "BLOQUEADO" | null;
  canOperate: boolean;
  reason: string;
  lastUpdate?: string;
  notes?: string | null;
  reviewedBy?: string | null;
};

/**
 * Determina si un empleado debe estar activo basado en su estado jurídico
 * - VIGENTE: puede estar activo
 * - EN_REVISION: debe estar inactivo
 * - BLOQUEADO: debe estar inactivo
 * - Sin estado: debe estar inactivo
 */
export function shouldEmployeeBeActive(
  status?: "VIGENTE" | "EN_REVISION" | "BLOQUEADO" | null
): boolean {
  if (!status) return false;
  return status === "VIGENTE";
}

export async function updateEmployeeLegalStatus(
  employeeId: string,
  data: LegalStatusUpdate
) {
  const validated = legalStatusSchema.safeParse(data);
  
  if (!validated.success) {
    throw new Error(validated.error.issues[0]?.message || "Datos inválidos");
  }

  const response = await apiJson<{ success: boolean; isActive: boolean }>(
    `/api/employees/${employeeId}/legal-status`,
    {
      method: "POST",
      body: JSON.stringify(validated.data),
    }
  );

  return response;
}

export async function getEmployeeLegalStatusHistory(employeeId: string) {
  const response = await apiJson<any>(
    `/api/employees/${employeeId}/legal-status-history`
  );
  return response;
}

/**
 * Verifica el estado jurídico actual de un empleado
 * Útil para validar si el empleado puede operar en otros módulos
 */
export async function checkEmployeeLegalStatus(
  employeeId: string
): Promise<EmployeeLegalStatusCheck> {
  try {
    const response = await apiJson<EmployeeLegalStatusCheck>(
      `/api/employees/${employeeId}/legal-status/check`
    );
    return response;
  } catch (error) {
    console.error("Error verificando estado jurídico del empleado:", error);
    return {
      status: null,
      canOperate: false,
      reason: "No se pudo verificar el estado jurídico",
    };
  }
}
