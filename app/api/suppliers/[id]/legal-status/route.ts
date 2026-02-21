import { db } from "@/src/db";
import { legalStatusRecords, suppliers } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/src/utils/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: supplierId } = await params;

  const limited = rateLimit(request, {
    key: `supplier:legal-status:${supplierId}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  try {
    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, supplierId),
      columns: { id: true, name: true, isActive: true },
    });

    if (!supplier) {
      return new Response("Proveedor no encontrado", { status: 404 });
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
      thirdPartyId: supplierId,
      thirdPartyType: "PROVEEDOR",
      thirdPartyName: supplier.name,
      status: status as "VIGENTE" | "EN_REVISION" | "BLOQUEADO",
      notes: notes || null,
      reviewedBy: reviewedBy || null,
    });

    const shouldBeActive = status === "VIGENTE";
    
    if (shouldBeActive !== supplier.isActive) {
      await db
        .update(suppliers)
        .set({ isActive: shouldBeActive })
        .where(eq(suppliers.id, supplierId));
    }

    console.log(
      `✅ Estado jurídico actualizado para proveedor ${supplierId}: ${status} (isActive: ${shouldBeActive})`
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
