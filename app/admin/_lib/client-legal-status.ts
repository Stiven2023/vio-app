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

export type ClientLegalStatusCheck = {
  status: "VIGENTE" | "EN_REVISION" | "BLOQUEADO" | null;
  canOperate: boolean;
  reason: string;
  lastUpdate?: string;
  notes?: string | null;
  reviewedBy?: string | null;
};

/**
 * Determina si un cliente debe estar activo basado en su estado jurídico
 * - VIGENTE: puede estar activo
 * - EN_REVISION: debe estar inactivo
 * - BLOQUEADO: debe estar inactivo
 * - Sin estado: debe estar inactivo
 */
export function shouldClientBeActive(
  status?: "VIGENTE" | "EN_REVISION" | "BLOQUEADO" | null
): boolean {
  if (!status) return false;
  return status === "VIGENTE";
}

export async function updateClientLegalStatus(
  clientId: string,
  data: LegalStatusUpdate
) {
  const validated = legalStatusSchema.safeParse(data);
  
  if (!validated.success) {
    throw new Error(validated.error.issues[0]?.message || "Datos inválidos");
  }

  const response = await apiJson<{ success: boolean; isActive: boolean }>(
    `/api/clients/${clientId}/legal-status`,
    {
      method: "POST",
      body: JSON.stringify(validated.data),
    }
  );

  return response;
}

export async function getClientLegalStatusHistory(clientId: string) {
  const response = await apiJson<any>(
    `/api/clients/${clientId}/legal-status-history`
  );
  return response;
}

/**
 * Verifica el estado jurídico actual de un cliente
 * Útil para validar si el cliente puede operar en otros módulos
 */
export async function checkClientLegalStatus(
  clientId: string
): Promise<ClientLegalStatusCheck> {
  try {
    const response = await apiJson<ClientLegalStatusCheck>(
      `/api/clients/${clientId}/legal-status/check`
    );
    return response;
  } catch (error) {
    console.error("Error verificando estado jurídico del cliente:", error);
    return {
      status: null,
      canOperate: false,
      reason: "No se pudo verificar el estado jurídico",
    };
  }
}
