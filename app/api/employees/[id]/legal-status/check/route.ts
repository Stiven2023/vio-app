import { db } from "@/src/db";
import { legalStatusRecords } from "@/src/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * GET /api/employees/[id]/legal-status/check
 * Obtiene el estado jurídico actual de un empleado (el más reciente)
 * Útil para validar si el empleado puede operar
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;

    // Obtener el estado jurídico más reciente
    const latestStatus = await db.query.legalStatusRecords.findFirst({
      where: eq(legalStatusRecords.thirdPartyId, employeeId),
      orderBy: desc(legalStatusRecords.createdAt),
      columns: {
        status: true,
        createdAt: true,
        notes: true,
        reviewedBy: true,
      },
    });

    // Si no hay estado jurídico, el empleado no puede operar
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
          ? "Empleado vigente y puede operar"
          : latestStatus.status === "EN_REVISION"
            ? "Empleado en revisión, no puede operar"
            : "Empleado bloqueado, no puede operar",
      lastUpdate: latestStatus.createdAt,
      notes: latestStatus.notes,
      reviewedBy: latestStatus.reviewedBy,
    });
  } catch (error) {
    console.error("❌ Error al verificar estado jurídico:", error);
    return Response.json(
      {
        status: null,
        canOperate: false,
        reason: "Error al verificar el estado jurídico",
      },
      { status: 500 }
    );
  }
}
