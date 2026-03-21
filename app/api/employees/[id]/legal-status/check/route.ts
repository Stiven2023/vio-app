import { and, desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { legalStatusRecords } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";

/**
 * GET /api/employees/[id]/legal-status/check
 * Obtiene el estado jurídico actual de un empleado (el más reciente)
 * Útil para validar si el empleado puede operar
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const forbidden = await requirePermission(
      request,
      "VER_ESTADO_JURIDICO_EMPLEADO",
    );

    if (forbidden) return forbidden;

    const { id: employeeId } = await params;

    // Obtener el estado jurídico más reciente
    const latestStatus = await db.query.legalStatusRecords.findFirst({
      where: and(
        eq(legalStatusRecords.thirdPartyId, employeeId),
        eq(legalStatusRecords.thirdPartyType, "EMPLEADO"),
      ),
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
      { status: 500 },
    );
  }
}
