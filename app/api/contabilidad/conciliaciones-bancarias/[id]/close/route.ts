import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { bankReconciliations } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "bank-reconciliations:close",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "CERRAR_CONCILIACION_BANCARIA",
  );

  if (forbidden) return forbidden;

  const { id } = await context.params;
  const reconciliationId = String(id ?? "").trim();

  if (!reconciliationId) {
    return new Response("id required", { status: 400 });
  }

  try {
    const employeeId = getEmployeeIdFromRequest(request);

    const [updated] = await db
      .update(bankReconciliations)
      .set({
        isClosed: true,
        closedAt: new Date(),
        closedBy: employeeId,
      })
      .where(
        and(
          eq(bankReconciliations.id, reconciliationId),
          eq(bankReconciliations.isClosed, false),
        ),
      )
      .returning({
        id: bankReconciliations.id,
        isClosed: bankReconciliations.isClosed,
      });

    if (!updated) {
      const [existing] = await db
        .select({
          id: bankReconciliations.id,
          isClosed: bankReconciliations.isClosed,
        })
        .from(bankReconciliations)
        .where(eq(bankReconciliations.id, reconciliationId))
        .limit(1);

      if (!existing?.id) {
        return new Response("Conciliacion no encontrada", { status: 404 });
      }

      return new Response("La conciliacion ya estaba cerrada", { status: 409 });
    }

    return Response.json({
      ok: true,
      id: updated.id,
      isClosed: updated.isClosed,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo cerrar la conciliacion", { status: 500 });
  }
}
