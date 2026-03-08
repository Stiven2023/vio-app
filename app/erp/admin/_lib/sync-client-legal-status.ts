import { db } from "@/src/db";
import { clientLegalStatusHistory } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Campos críticos que cuando cambian requieren revisión jurídica
 */
const CRITICAL_FIELDS_FOR_LEGAL_REVIEW = [
  "name",
  "identificationType",
  "identification",
  "dv",
  "taxRegime",
  "contactName",
  "address",
  "identityDocumentUrl",
  "rutDocumentUrl",
  "commerceChamberDocumentUrl",
  "passportDocumentUrl",
  "taxCertificateDocumentUrl",
  "companyIdDocumentUrl",
];

/**
 * Detecta qué campos críticos fueron modificados en un cliente
 */
export function detectCriticalFieldChanges(
  oldData: Record<string, any>,
  newData: Record<string, any>
): string[] {
  const changedFields: string[] = [];

  for (const field of CRITICAL_FIELDS_FOR_LEGAL_REVIEW) {
    const oldValue = oldData?.[field];
    const newValue = newData?.[field];

    if (oldValue !== newValue) {
      changedFields.push(field);
    }
  }

  return changedFields;
}

/**
 * Sincroniza el estado activo del cliente basado en su estado jurídico más reciente
 * - Si no tiene estado jurídico: isActive = false
 * - Si está EN_REVISION: isActive = false
 * - Si está BLOQUEADO: isActive = false
 * - Si está VIGENTE: isActive = true (pero respeta la preferencia si se pasa)
 * 
 * @param clientId ID del cliente
 * @param preferredIsActive valor deseado para isActive (si el estado jurídico lo permite)
 * @returns boolean - el valor final que debe tener isActive
 */
export async function syncClientLegalStatusWithIsActive(
  clientId: string,
  preferredIsActive?: boolean
): Promise<boolean> {
  try {
    // Obtener el estado jurídico más reciente
    const latestStatus = await db.query.clientLegalStatusHistory.findFirst({
      where: eq(clientLegalStatusHistory.clientId, clientId),
      orderBy: desc(clientLegalStatusHistory.createdAt),
      columns: {
        status: true,
      },
    });

    // Si no tiene estado jurídico o no está VIGENTE, debe estar inactivo
    if (!latestStatus || latestStatus.status !== "VIGENTE") {
      return false;
    }

    // Si está VIGENTE, usa la preferencia o true por defecto
    return preferredIsActive ?? true;
  } catch (error) {
    console.error("Error sincronizando estado jurídico del cliente:", error);
    // En caso de error, ser conservador: desactivar el cliente
    return false;
  }
}

/**
 * Obtiene el estado jurídico más reciente de un cliente
 */
export async function getLatestClientLegalStatus(
  clientId: string
): Promise<"VIGENTE" | "EN_REVISION" | "BLOQUEADO" | null> {
  try {
    const latest = await db.query.clientLegalStatusHistory.findFirst({
      where: eq(clientLegalStatusHistory.clientId, clientId),
      orderBy: desc(clientLegalStatusHistory.createdAt),
      columns: {
        status: true,
      },
    });

    return latest?.status ?? null;
  } catch (error) {
    console.error("Error obteniendo estado jurídico del cliente:", error);
    return null;
  }
}

/**
 * Registra automáticamente un cambio de estado jurídico cuando el cliente es modificado
 */
export async function registerAutoRevisionOnClientChange(
  clientId: string,
  clientName: string,
  changedFields: string[]
): Promise<void> {
  try {
    await db.insert(clientLegalStatusHistory).values({
      clientId,
      clientName,
      status: "EN_REVISION" as const,
      notes: `Cambios detectados en ${changedFields.length} campo(s) requieren revisión jurídica`,
      reviewedBy: "SISTEMA",
      changedFields: JSON.stringify(changedFields),
    });

    console.log(
      `✅ Revisión automática registrada para cliente ${clientId}: ${changedFields.length} campo(s) modificado(s)`
    );
  } catch (error) {
    console.error("Error registrando revisión automática:", error);
    throw error;
  }
}
