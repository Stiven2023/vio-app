import { db } from "@/src/db";
import { legalStatusRecords } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: packerId } = await params;

    const history = await db.query.legalStatusRecords.findMany({
      where: eq(legalStatusRecords.thirdPartyId, packerId),
      orderBy: desc(legalStatusRecords.createdAt),
    });

    return Response.json(history);
  } catch (error) {
    console.error("❌ Error al obtener historial:", error);
    return new Response(
      `Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
      { status: 500 }
    );
  }
}
