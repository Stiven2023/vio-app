import { db } from "@/src/db";
import { legalStatusRecords, packers } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/src/utils/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packerId } = await params;

  const limited = rateLimit(request, {
    key: `packer:legal-status:${packerId}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  try {
    const packer = await db.query.packers.findFirst({
      where: eq(packers.id, packerId),
      columns: { id: true, name: true, isActive: true },
    });

    if (!packer) {
      return new Response("Empacador no encontrado", { status: 404 });
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
      thirdPartyId: packerId,
      thirdPartyType: "EMPAQUE",
      thirdPartyName: packer.name,
      status: status as "VIGENTE" | "EN_REVISION" | "BLOQUEADO",
      notes: notes || null,
      reviewedBy: reviewedBy || null,
    });

    const shouldBeActive = status === "VIGENTE";
    
    if (shouldBeActive !== packer.isActive) {
      await db
        .update(packers)
        .set({ isActive: shouldBeActive })
        .where(eq(packers.id, packerId));
    }

    console.log(
      `✅ Estado jurídico actualizado para empacador ${packerId}: ${status} (isActive: ${shouldBeActive})`
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
