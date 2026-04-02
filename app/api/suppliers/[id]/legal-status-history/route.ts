import { and, desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { legalStatusRecords } from "@/src/db/erp/schema";
import { requirePermission } from "@/src/utils/permission-middleware";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const forbidden = await requirePermission(
      request,
      "VER_ESTADO_JURIDICO_PROVEEDOR",
    );

    if (forbidden) return forbidden;

    const { id: supplierId } = await params;

    const history = await db.query.legalStatusRecords.findMany({
      where: and(
        eq(legalStatusRecords.thirdPartyId, supplierId),
        eq(legalStatusRecords.thirdPartyType, "PROVEEDOR"),
      ),
      orderBy: desc(legalStatusRecords.createdAt),
    });

    return Response.json(history);
  } catch (error) {
    console.error("❌ Error al obtener historial:", error);

    return new Response(
      `Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
      { status: 500 },
    );
  }
}
