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

export async function updateSupplierLegalStatus(
  supplierId: string,
  data: LegalStatusUpdate
) {
  const validated = legalStatusSchema.safeParse(data);
  
  if (!validated.success) {
    throw new Error(validated.error.issues[0]?.message || "Datos inválidos");
  }

  const response = await apiJson<{ success: boolean; isActive: boolean }>(
    `/api/suppliers/${supplierId}/legal-status`,
    {
      method: "POST",
      body: JSON.stringify(validated.data),
    }
  );

  return response;
}

export async function getSupplierLegalStatusHistory(supplierId: string) {
  const response = await apiJson<any>(
    `/api/suppliers/${supplierId}/legal-status-history`
  );
  return response;
}

export async function checkSupplierLegalStatus(
  supplierId: string
): Promise<any> {
  try {
    const response = await apiJson<any>(
      `/api/suppliers/${supplierId}/legal-status/check`
    );
    return response;
  } catch (error) {
    console.error("Error verificando estado jurídico del proveedor:", error);
    return {
      status: null,
      canOperate: false,
      reason: "No se pudo verificar el estado jurídico",
    };
  }
}
