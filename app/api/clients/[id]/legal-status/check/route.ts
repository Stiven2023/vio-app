import { db } from "@/src/db";
import { clientLegalStatusHistory } from "@/src/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * GET /api/clients/[id]/legal-status/check
 * Obtiene el estado jurídico actual de un cliente (el más reciente)
 * Útil para validar si el cliente puede operar
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Determinar si puede operar basado en el estado
    const canOperate = latestStatus.status === "VIGENTE";

    return Response.json({
      status: latestStatus.status,
      canOperate,
      reason:
        latestStatus.status === "VIGENTE"
          ? "Cliente vigente y puede operar"
          : latestStatus.status === "EN_REVISION"
            ? "Cliente en revisión, no puede operar"
            : "Cliente bloqueado, no puede operar",
      lastUpdate: latestStatus.createdAt,
      notes: latestStatus.notes,
      reviewedBy: latestStatus.reviewedBy,
    });
  } catch (error) {
    console.error("❌ Error al obtener estado jurídico:", error);
    return new Response(
      `Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
      { status: 500 }
    );
  }
}
