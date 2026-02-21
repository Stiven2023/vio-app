import { db } from "@/src/db";
import { clientLegalStatusHistory, clients } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { desc } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    
    // Verificar que el cliente existe
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, clientId),
      columns: { id: true },
    });

    if (!client) {
      return new Response("Cliente no encontrado", { status: 404 });
    }

    // Obtener historial ordenado por fecha descendente (más reciente primero)
    const history = await db.query.clientLegalStatusHistory.findMany({
      where: eq(clientLegalStatusHistory.clientId, clientId),
      orderBy: desc(clientLegalStatusHistory.createdAt),
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
