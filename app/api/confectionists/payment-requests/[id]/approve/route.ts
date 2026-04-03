import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { confectionistPaymentRequests } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function str(value: unknown) {
  return String(value ?? "").trim();
}

/** PUT /api/confectionists/payment-requests/[id]/approve */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "confectionists:payment-requests:approve",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "APROBAR_PAGO_CONFECCION");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const requestId = str(id);

    if (!requestId) return new Response("id required", { status: 400 });

    const result = await db.transaction(async (tx) => {
      const [req] = await tx
        .select({ id: confectionistPaymentRequests.id, status: confectionistPaymentRequests.status })
        .from(confectionistPaymentRequests)
        .where(eq(confectionistPaymentRequests.id, requestId))
        .limit(1);

      if (!req) return { kind: "not-found" as const };
      if (req.status !== "VERIFICADO") return { kind: "invalid-status" as const, status: req.status };

      const employeeId = getEmployeeIdFromRequest(request);

      await tx
        .update(confectionistPaymentRequests)
        .set({ status: "APROBADO", approvedBy: employeeId, approvedAt: new Date(), updatedAt: new Date() })
        .where(eq(confectionistPaymentRequests.id, requestId));

      return { kind: "ok" as const };
    });

    if (result.kind === "not-found") return new Response("Solicitud no encontrada", { status: 404 });
    if (result.kind === "invalid-status") {
      return new Response(`Solo las solicitudes VERIFICADAS pueden aprobarse (estado actual: ${result.status})`, { status: 422 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo aprobar la solicitud", { status: 500 });
  }
}
