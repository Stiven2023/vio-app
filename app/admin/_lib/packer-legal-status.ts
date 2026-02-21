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

export async function updatePackerLegalStatus(
  packerId: string,
  data: LegalStatusUpdate
) {
  const validated = legalStatusSchema.safeParse(data);
  
  if (!validated.success) {
    throw new Error(validated.error.issues[0]?.message || "Datos inválidos");
  }

  const response = await apiJson<{ success: boolean; isActive: boolean }>(
    `/api/packers/${packerId}/legal-status`,
    {
      method: "POST",
      body: JSON.stringify(validated.data),
    }
  );

  return response;
}

export async function getPackerLegalStatusHistory(packerId: string) {
  const response = await apiJson<any>(
    `/api/packers/${packerId}/legal-status-history`
  );
  return response;
}

export async function checkPackerLegalStatus(
  packerId: string
): Promise<any> {
  try {
    const response = await apiJson<any>(
      `/api/packers/${packerId}/legal-status/check`
    );
    return response;
  } catch (error) {
    console.error("Error verificando estado jurídico del empacador:", error);
    return {
      status: null,
      canOperate: false,
      reason: "No se pudo verificar el estado jurídico",
    };
  }
}
