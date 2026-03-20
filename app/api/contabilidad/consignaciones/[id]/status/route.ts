import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { orderPayments } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "PAGADO" || raw === "CONSIGNADO") return "PAGADO" as const;
  if (raw === "CONFIRMADO_CAJA") return "CONFIRMADO_CAJA" as const;
  if (raw === "ANULADO" || raw === "NO_CONSIGNADO" || raw === "DESECHADO") {
    return "ANULADO" as const;
  }
  return null;
}


export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "contabilidad:consignaciones:status:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "APROBAR_PAGO");
  if (forbidden) return forbidden;

  const { id } = await params;
  const paymentId = String(id ?? "").trim();
  if (!paymentId) return new Response("id requerido", { status: 400 });

  try {
    const body = (await request.json()) as { status?: unknown };
    const status = normalizeStatus(body.status);

    if (!status) {
      return new Response("status inválido. Usa PAGADO/CONSIGNADO o ANULADO/DESECHADO", {
        status: 400,
      });
    }

    const [updated] = await db
      .update(orderPayments)
      .set({ status: status as any })
      .where(eq(orderPayments.id, paymentId))
      .returning({
        id: orderPayments.id,
        status: orderPayments.status,
        orderId: orderPayments.orderId,
      });

    if (!updated) return new Response("Consignación no encontrada", { status: 404 });

    return Response.json({ ok: true, id: updated.id, status: updated.status });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo actualizar el estado de la consignación", { status: 500 });
  }
}
