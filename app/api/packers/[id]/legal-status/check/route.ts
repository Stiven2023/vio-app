import { db } from "@/src/db";
import { legalStatusRecords } from "@/src/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: packerId } = await params;

    const latestStatus = await db.query.legalStatusRecords.findFirst({
      where: eq(legalStatusRecords.thirdPartyId, packerId),
      orderBy: desc(legalStatusRecords.createdAt),
      columns: {
        status: true,
        createdAt: true,
        notes: true,
        reviewedBy: true,
      },
    });

    if (!latestStatus) {
      return Response.json({
        status: null,
        canOperate: false,
        reason: "Sin estado jurídico definido",
      });
    }

    const canOperate = latestStatus.status === "VIGENTE";

    return Response.json({
      status: latestStatus.status,
      canOperate,
      reason:
        latestStatus.status === "VIGENTE"
          ? "Empacador vigente y puede operar"
          : latestStatus.status === "EN_REVISION"
            ? "Empacador en revisión, no puede operar"
            : "Empacador bloqueado, no puede operar",
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
