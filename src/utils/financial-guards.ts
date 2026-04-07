/**
 * financial-guards.ts
 *
 * Utilidades de control interno para operaciones financieras:
 *
 *  1. Umbral de doble aprobación para montos altos en COP
 *  2. Verificación de estado legal del cliente antes de operaciones financieras
 *
 * Estas funciones no emiten respuestas HTTP directamente; retornan objetos
 * descriptivos para que el endpoint decida cómo responder.
 */

import { eq } from "drizzle-orm";

import { clientLegalStatus } from "@/src/db/schema";

// ---------------------------------------------------------------------------
// 1. DOBLE APROBACIÓN — montos altos en COP
// ---------------------------------------------------------------------------

/** Umbral en COP por encima del cual se exige confirmación explícita. 5 000 000 COP */
export const HIGH_AMOUNT_THRESHOLD_COP = 5_000_000;

/**
 * Retorna `true` cuando el monto supera el umbral de doble aprobación.
 * El endpoint debe comprobar que el request incluya `{ confirmed: true }` en el body.
 */
export function requiresDoubleApproval(amount: number): boolean {
  return Number.isFinite(amount) && amount >= HIGH_AMOUNT_THRESHOLD_COP;
}

// ---------------------------------------------------------------------------
// 2. ESTADO LEGAL DEL CLIENTE
// ---------------------------------------------------------------------------

export type ClientLegalCheckResult =
  | { blocked: false }
  | { blocked: true; reason: string };

/**
 * Verifica si un cliente está habilitado legalmente para operar.
 *
 * - Si no existe registro en `client_legal_status` → se asume habilitado
 *   (opt-in: solo bloquea si hay un registro explícito de inhabilitación).
 * - Si `isLegallyEnabled = false` → bloqueado.
 *
 * Se puede pasar `tx` (transacción Drizzle) para ejecutar dentro de una transacción activa.
 */
export async function checkClientLegalStatus(
  clientId: string,
  tx?: any,
): Promise<ClientLegalCheckResult> {
  // Lazy import to avoid loading DB env at module parse time in tests
  const { db } = await import("@/src/db");
  const dbOrTx = tx ?? db;

  const [record] = await (dbOrTx as typeof db)
    .select({
      isLegallyEnabled: clientLegalStatus.isLegallyEnabled,
      legalNotes: clientLegalStatus.legalNotes,
    })
    .from(clientLegalStatus)
    .where(eq(clientLegalStatus.clientId, clientId))
    .limit(1);

  if (!record) {
    return { blocked: false };
  }

  if (record.isLegallyEnabled === false) {
    const reason =
      record.legalNotes?.trim() ||
      "El cliente tiene restricciones legales activas que impiden operaciones financieras.";

    return { blocked: true, reason };
  }

  return { blocked: false };
}
