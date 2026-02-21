import { db } from "@/src/db";
import { clientLegalStatusHistory, clients } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/src/utils/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  const limited = rateLimit(request, {
    key: `client:legal-status:${clientId}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  try {
    // Verificar que el cliente existe
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, clientId),
      columns: { id: true, name: true, isActive: true },
    });

    if (!client) {
      return new Response("Cliente no encontrado", { status: 404 });
    }

    const body = (await request.json()) as {
      status?: string;
      notes?: string;
      reviewedBy?: string;
    };

    const { status = "VIGENTE", notes = "", reviewedBy = "" } = body;

    // Validar estado
    if (!["VIGENTE", "EN_REVISION", "BLOQUEADO"].includes(status)) {
      return new Response("Estado jurídico inválido", { status: 400 });
    }

    // Crear registro de historial
    await db.insert(clientLegalStatusHistory).values({
      clientId,
      clientName: client.name,
      status: status as "VIGENTE" | "EN_REVISION" | "BLOQUEADO",
      notes: notes || null,
      reviewedBy: reviewedBy || null,
    });

    // Actualizar isActive del cliente basado en el estado jurídico
    const shouldBeActive = status === "VIGENTE";
    
    if (shouldBeActive !== client.isActive) {
      await db
        .update(clients)
        .set({ isActive: shouldBeActive })
        .where(eq(clients.id, clientId));
    }

    console.log(
      `✅ Estado jurídico actualizado para cliente ${clientId}: ${status} (isActive: ${shouldBeActive})`
    );

    return Response.json({ success: true, isActive: shouldBeActive });
  } catch (error) {
    console.error("❌ Error al actualizar estado jurídico:", error);
    return new Response(
      `Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
      { status: 500 }
    );
  }
}
