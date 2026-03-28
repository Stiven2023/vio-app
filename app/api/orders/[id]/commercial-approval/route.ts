import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { orderStatusHistory, orders } from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type CommercialAction = "APPROVE" | "WAIT_FOR_PAYMENT";

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isAllowedCommercialRole(role: string | null) {
  return role === "ADMINISTRADOR" || role === "LIDER_COMERCIAL";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "orders:commercial-approval",
    limit: 90,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CAMBIAR_ESTADO_PEDIDO");

  if (forbidden) return forbidden;

  const role = getRoleFromRequest(request);
  const employeeId = getEmployeeIdFromRequest(request);

  if (!isAllowedCommercialRole(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    note?: unknown;
  };

  const action = String(body.action ?? "")
    .trim()
    .toUpperCase() as CommercialAction;
  const note = String(body.note ?? "").trim();

  if (action !== "APPROVE" && action !== "WAIT_FOR_PAYMENT") {
    return new Response("action must be APPROVE or WAIT_FOR_PAYMENT", {
      status: 400,
    });
  }

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("id required", { status: 400 });

  const [orderRow] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return new Response("Not found", { status: 404 });

  const currentStatus = normalizeStatus(orderRow.status);

  if (currentStatus !== "APROBACION") {
    return new Response(
      "La decision comercial solo aplica cuando el pedido esta en APROBACION.",
      { status: 422 },
    );
  }

  const reasonCode =
    action === "APPROVE" ? "COMMERCIAL_APPROVED" : "COMMERCIAL_WAITING_PAYMENT";

  await db.insert(orderStatusHistory).values({
    orderId,
    status: "APROBACION" as any,
    changedBy: employeeId,
    reasonCode,
    meta: {
      action,
      note: note || null,
      decidedByRole: role,
    },
  });

  return Response.json({
    ok: true,
    orderId,
    status: "APROBACION",
    action,
    reasonCode,
    message:
      action === "APPROVE"
        ? "Aprobacion comercial registrada."
        : "Comercial marco el pedido en espera de abono.",
  });
}
