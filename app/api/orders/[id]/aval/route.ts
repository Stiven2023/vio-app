import { eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, orderItems, orders } from "@/src/db/erp/schema";
import {
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type OrderTypeCode = "VN" | "VI" | "VT" | "VW";

function isUniqueViolation(e: unknown) {
  const code = (e as any)?.code;

  return code === "23505";
}

async function generateOfficialOrderCode(
  tx: any,
  type: OrderTypeCode,
): Promise<string> {
  const prefix = `${type}-`;
  const seqLen = type === "VI" ? 4 : 6;
  const pattern = `(?i)^${type}-(?:[0-9]{8}-)?([0-9]+)$`;

  const [row] = await tx
    .select({
      maxSeq: sql<number>`max((substring(${orders.orderCode} from ${pattern})::int))`,
    })
    .from(orders)
    .where(ilike(orders.orderCode, `${type}-%`))
    .limit(1);

  const maxSeq = Number(row?.maxSeq ?? 0);
  const nextSeq = Number.isFinite(maxSeq) ? maxSeq + 1 : 1;

  return `${prefix}${String(nextSeq).padStart(seqLen, "0")}`;
}

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

/**
 * POST /api/orders/:id/aval
 *
 * Grants operational approval ("aval") to an order. This:
 * 1. Sets operationalApprovedAt and operationalApprovedBy.
 * 2. Calculates designDeadline for each item using estimatedLeadDays from
 *    approval date (not creation date).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "orders:aval",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CAMBIAR_ESTADO_PEDIDO");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const orderId = String(id ?? "").trim();

    if (!orderId) return new Response("id required", { status: 400 });

    const employeeId = await resolveEmployeeId(request);

    const [order] = await db
      .select({
        id: orders.id,
        type: orders.type,
        orderCode: orders.orderCode,
        provisionalCode: (orders as any).provisionalCode,
        operationalApprovedAt: (orders as any).operationalApprovedAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) return new Response("Pedido no encontrado", { status: 404 });

    if ((order as any).operationalApprovedAt) {
      return new Response("El pedido ya tiene aval operativo", { status: 409 });
    }

    const approvedAt = new Date();

    const normalizedType = String(order.type ?? "VN").toUpperCase();
    const officialType: OrderTypeCode =
      normalizedType === "VI" ||
      normalizedType === "VT" ||
      normalizedType === "VW"
        ? (normalizedType as OrderTypeCode)
        : "VN";

    let officialCode: string | null = null;

    await db.transaction(async (tx) => {
      // Assign official code at aval time.
      for (let attempt = 0; attempt < 5; attempt++) {
        const nextCode = await generateOfficialOrderCode(tx, officialType);

        try {
          await tx
            .update(orders)
            .set({
              orderCode: nextCode,
              provisionalCode:
                (order as any).provisionalCode ?? String(order.orderCode ?? ""),
              operationalApprovedAt: approvedAt,
              operationalApprovedBy: employeeId,
            } as any)
            .where(eq(orders.id, orderId));

          officialCode = nextCode;
          break;
        } catch (e) {
          if (!isUniqueViolation(e) || attempt === 4) throw e;
        }
      }

      if (!officialCode) {
        throw new Error("No se pudo generar código oficial");
      }

      // Calculate designDeadline for each item using approval date.
      const items = await tx
        .select({
          id: orderItems.id,
          estimatedLeadDays: orderItems.estimatedLeadDays,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      for (const item of items) {
        const leadDays = Number(item.estimatedLeadDays ?? 0);

        if (!leadDays || leadDays <= 0) continue;

        const deadline = new Date(approvedAt);

        deadline.setDate(deadline.getDate() + leadDays);
        const deadlineStr = deadline.toISOString().slice(0, 10);

        await tx
          .update(orderItems)
          .set({ designDeadline: deadlineStr } as any)
          .where(eq(orderItems.id, item.id));
      }
    });

    return Response.json({
      ok: true,
      operationalApprovedAt: approvedAt,
      officialOrderCode: officialCode,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo registrar el aval", { status: 500 });
  }
}
