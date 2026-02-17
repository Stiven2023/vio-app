import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, orderItemIssues, orderItems } from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

async function resolveEmployeeId(request: Request) {
  const direct = getEmployeeIdFromRequest(request);

  if (direct) return direct;

  const userId = getUserIdFromRequest(request);
  if (!userId) return null;

  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  return row?.id ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-issues:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");
  if (forbidden) return forbidden;

  const { id } = await params;
  const orderItemId = String(id ?? "").trim();
  if (!orderItemId) return new Response("id required", { status: 400 });

  try {
    const items = await db
      .select({
        id: orderItemIssues.id,
        orderItemId: orderItemIssues.orderItemId,
        message: orderItemIssues.message,
        role: orderItemIssues.role,
        statusSnapshot: orderItemIssues.statusSnapshot,
        createdAt: orderItemIssues.createdAt,
      })
      .from(orderItemIssues)
      .where(eq(orderItemIssues.orderItemId, orderItemId))
      .orderBy(desc(orderItemIssues.createdAt));

    return Response.json({ items });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudieron cargar problemas", { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-issues:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");
  if (forbidden) return forbidden;

  const { id } = await params;
  const orderItemId = String(id ?? "").trim();
  if (!orderItemId) return new Response("id required", { status: 400 });

  const body = (await request.json().catch(() => ({}))) as any;
  const message = String(body?.message ?? "").trim();
  if (!message) return new Response("message required", { status: 400 });

  try {
    const role = getRoleFromRequest(request);
    const employeeId = await resolveEmployeeId(request);

    const [row] = await db
      .select({ status: orderItems.status, orderId: orderItems.orderId, name: orderItems.name })
      .from(orderItems)
      .where(eq(orderItems.id, orderItemId))
      .limit(1);

    if (!row) return new Response("Not found", { status: 404 });

    const created = await db
      .insert(orderItemIssues)
      .values({
        orderItemId,
        message,
        role: role ? String(role) : null,
        statusSnapshot: row.status ? String(row.status) : null,
        createdBy: employeeId,
      })
      .returning();

    await createNotificationsForPermission("VER_PEDIDO", {
      title: "Problema reportado",
      message: `Problema en diseño: ${row.name ?? "(sin nombre)"}.`,
      href: row.orderId ? `/orders/${row.orderId}/items/${orderItemId}` : "/orders",
    });

    return Response.json(created[0] ?? null, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo reportar el problema", { status: 500 });
  }
}
