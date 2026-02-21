import { db } from "@/src/db";
import { legalStatusRecords, confectionists } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/src/utils/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: confectionistId } = await params;

  const limited = rateLimit(request, {
    key: `confectionist:legal-status:${confectionistId}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  try {
    const confectionist = await db.query.confectionists.findFirst({
      where: eq(confectionists.id, confectionistId),
      columns: { id: true, name: true, isActive: true },
    });

    if (!confectionist) {
      return new Response("Confeccionista no encontrado", { status: 404 });
    }

    const body = (await request.json()) as {
      status?: string;
      notes?: string;
      reviewedBy?: string;
    };

    const { status = "VIGENTE", notes = "", reviewedBy = "" } = body;

    if (!["VIGENTE", "EN_REVISION", "BLOQUEADO"].includes(status)) {
      return new Response("Estado jurídico inválido", { status: 400 });
    }

    await db.insert(legalStatusRecords).values({
      thirdPartyId: confectionistId,
      thirdPartyType: "CONFECCIONISTA",
      thirdPartyName: confectionist.name,
      status: status as "VIGENTE" | "EN_REVISION" | "BLOQUEADO",
      notes: notes || null,
      reviewedBy: reviewedBy || null,
    });

    const shouldBeActive = status === "VIGENTE";
    
    if (shouldBeActive !== confectionist.isActive) {
      await db
        .update(confectionists)
        .set({ isActive: shouldBeActive })
        .where(eq(confectionists.id, confectionistId));
    }

    console.log(
      `✅ Estado jurídico actualizado para confeccionista ${confectionistId}: ${status} (isActive: ${shouldBeActive})`
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
