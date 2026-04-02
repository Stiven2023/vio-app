import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { clientLegalStatusHistory } from "@/src/db/erp/schema";
import { requirePermission } from "@/src/utils/permission-middleware";

/**
 * GET /api/clients/[id]/legal-status/check
 * Obtiene el estado jurídico actual de un cliente (el más reciente)
 * Útil para validar si el cliente puede operar
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const forbidden = await requirePermission(
      request,
      "VER_ESTADO_JURIDICO_CLIENTE",
    );

    if (forbidden) return forbidden;

    const { id: clientId } = await params;

    // Obtener el estado jurídico más reciente
    const latestStatus = await db.query.clientLegalStatusHistory.findFirst({
      where: eq(clientLegalStatusHistory.clientId, clientId),
      orderBy: desc(clientLegalStatusHistory.createdAt),
      columns: {
        status: true,
        createdAt: true,
        notes: true,
        reviewedBy: true,
      },
    });

    // Si no hay estado jurídico, el cliente no puede operar
    if (!latestStatus) {
      return Response.json({
        status: null,
        canOperate: false,
        reason: "Sin estado jurídico definido",
      });
    }

    // Determinar si puede operar basado en el estado.
    // EN_REVISION puede operar (creación/edición), pero puede tener restricciones de despacho.
    const canOperate = latestStatus.status !== "BLOQUEADO";

    return Response.json({
      status: latestStatus.status,
      canOperate,
      reason:
        latestStatus.status === "VIGENTE"
          ? "Cliente vigente y puede operar"
          : latestStatus.status === "EN_REVISION"
            ? "Cliente en revisión: puede operar, con restricción de despacho"
            : "Cliente bloqueado, no puede operar",
      lastUpdate: latestStatus.createdAt,
      notes: latestStatus.notes,
      reviewedBy: latestStatus.reviewedBy,
    });
  } catch (error) {
    console.error("❌ Error al obtener estado jurídico:", error);

    return new Response(
      `Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
      { status: 500 },
    );
  }
}
