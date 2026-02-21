import { db } from "@/src/db";
import { legalStatusRecords, employees } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/src/utils/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: employeeId } = await params;

  const limited = rateLimit(request, {
    key: `employee:legal-status:${employeeId}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  try {
    // Verificar que el empleado existe
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
      columns: { id: true, name: true, isActive: true },
    });

    if (!employee) {
      return new Response("Empleado no encontrado", { status: 404 });
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

    const employeeName = employee.name;

    // Crear registro de historial usando tabla genérica
    await db.insert(legalStatusRecords).values({
      thirdPartyId: employeeId,
      thirdPartyType: "EMPLEADO",
      thirdPartyName: employeeName,
      status: status as "VIGENTE" | "EN_REVISION" | "BLOQUEADO",
      notes: notes || null,
      reviewedBy: reviewedBy || null,
    });

    // Actualizar isActive del empleado basado en el estado jurídico
    const shouldBeActive = status === "VIGENTE";
    
    if (shouldBeActive !== employee.isActive) {
      await db
        .update(employees)
        .set({ isActive: shouldBeActive })
        .where(eq(employees.id, employeeId));
    }

    console.log(
      `✅ Estado jurídico actualizado para empleado ${employeeId}: ${status} (isActive: ${shouldBeActive})`
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
