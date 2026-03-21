import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  mesProductionQueue,
  orders,
  prefacturas,
  quotations,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { rateLimit } from "@/src/utils/rate-limit";

const ALLOWED_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_OPERACIONAL",
  "PROGRAMACION",
]);

const PRIORITY_VALUES = ["URGENTE", "NORMAL", "BAJA"] as const;

function canWrite(role: string | null) {
  return role === "ADMINISTRADOR" || role === "LIDER_OPERACIONAL";
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:production-queue:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!role || !ALLOWED_ROLES.has(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const items = await db
      .select({
        id: mesProductionQueue.id,
        orderId: mesProductionQueue.orderId,
        orderItemId: mesProductionQueue.orderItemId,
        design: mesProductionQueue.design,
        size: mesProductionQueue.size,
        quantityTotal: mesProductionQueue.quantityTotal,
        priority: mesProductionQueue.priority,
        prioritySetBy: mesProductionQueue.prioritySetBy,
        prioritySetAt: mesProductionQueue.prioritySetAt,
        suggestedOrder: mesProductionQueue.suggestedOrder,
        finalOrder: mesProductionQueue.finalOrder,
        status: mesProductionQueue.status,
        confirmedAt: mesProductionQueue.confirmedAt,
        createdAt: mesProductionQueue.createdAt,
        updatedAt: mesProductionQueue.updatedAt,
        orderCode: orders.orderCode,
        clientName: clients.name,
        deliveryDate: quotations.deliveryDate,
      })
      .from(mesProductionQueue)
      .innerJoin(orders, eq(mesProductionQueue.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .leftJoin(prefacturas, eq(prefacturas.orderId, orders.id))
      .leftJoin(quotations, eq(quotations.id, prefacturas.quotationId))
      .where(eq(mesProductionQueue.status, "EN_COLA"))
      .orderBy(
        // URGENTE always first
        sql`case when ${mesProductionQueue.priority} = 'URGENTE' then 0 when ${mesProductionQueue.priority} = 'NORMAL' then 1 else 2 end`,
        asc(mesProductionQueue.finalOrder),
        asc(mesProductionQueue.suggestedOrder),
      );

    return Response.json({ items });
  } catch (error) {
    const resp = dbErrorResponse(error);

    if (resp) return resp;

    return new Response("Error al consultar cola de producción", {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:production-queue:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!role || !canWrite(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const employeeId = getEmployeeIdFromRequest(request);

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const orderId = String(body.orderId ?? "").trim();
    const orderItemId = String(body.orderItemId ?? "").trim();
    const design = String(body.design ?? "").trim();
    const size = body.size ? String(body.size).trim() : null;
    const quantityTotal = Math.max(
      0,
      Math.floor(Number(body.quantityTotal ?? 0)),
    );
    const priority = PRIORITY_VALUES.includes(
      body.priority as (typeof PRIORITY_VALUES)[number],
    )
      ? (body.priority as (typeof PRIORITY_VALUES)[number])
      : "NORMAL";

    if (!orderId) return new Response("orderId es requerido", { status: 400 });
    if (!orderItemId)
      return new Response("orderItemId es requerido", { status: 400 });
    if (!design) return new Response("design es requerido", { status: 400 });

    // Calculate suggested order by delivery date (from quotation via prefactura)
    const [orderRow] = await db
      .select({
        deliveryDate: quotations.deliveryDate,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(prefacturas, eq(prefacturas.orderId, orders.id))
      .leftJoin(quotations, eq(quotations.id, prefacturas.quotationId))
      .where(eq(orders.id, orderId))
      .limit(1);

    const deliveryStr = orderRow?.deliveryDate ?? null;
    const deliveryTs = deliveryStr
      ? new Date(deliveryStr).getTime()
      : orderRow?.createdAt
        ? new Date(orderRow.createdAt).getTime()
        : Date.now();
    const suggestedOrder = Math.floor(deliveryTs / 1000);

    // Count urgent items to place URGENTE at top
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(mesProductionQueue)
      .where(
        and(
          eq(mesProductionQueue.status, "EN_COLA"),
          eq(mesProductionQueue.priority, "URGENTE"),
        ),
      );

    const finalOrder =
      priority === "URGENTE" ? cnt + 1 : suggestedOrder + 1_000_000;

    const [created] = await db
      .insert(mesProductionQueue)
      .values({
        orderId,
        orderItemId,
        design,
        size,
        quantityTotal,
        priority,
        prioritySetBy: priority !== "NORMAL" ? employeeId : null,
        prioritySetAt: priority !== "NORMAL" ? new Date() : null,
        suggestedOrder,
        finalOrder,
        status: "EN_COLA",
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (error) {
    const resp = dbErrorResponse(error);

    if (resp) return resp;

    return new Response("Error al crear entrada en cola de producción", {
      status: 500,
    });
  }
}
