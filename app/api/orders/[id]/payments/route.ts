import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { orderPayments, orders } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { createNotificationsForPermission } from "@/src/utils/notifications";

function toNullableNumericString(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));

  if (Number.isNaN(n)) return null;

  return String(n);
}

function toPositiveNumericString(v: unknown) {
  const raw = toNullableNumericString(v);
  const n = raw ? Number(raw) : 0;

  if (!Number.isFinite(n) || n <= 0) return null;

  return String(n);
}

const methods = new Set(["EFECTIVO", "TRANSFERENCIA", "CREDITO"]);
const statuses = new Set(["PENDIENTE", "PARCIAL", "PAGADO", "ANULADO"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-payments:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("id required", { status: 400 });

  const where = and(eq(orderPayments.orderId, orderId));

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(orderPayments)
    .where(where);

  const items = await db
    .select({
      id: orderPayments.id,
      orderId: orderPayments.orderId,
      amount: orderPayments.amount,
      method: orderPayments.method,
      status: orderPayments.status,
      proofImageUrl: orderPayments.proofImageUrl,
      createdAt: orderPayments.createdAt,
    })
    .from(orderPayments)
    .where(where)
    .orderBy(desc(orderPayments.createdAt))
    .limit(pageSize)
    .offset(offset);

  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-payments:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PAGO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("id required", { status: 400 });

  const body = (await request.json()) as any;

  const amount = toPositiveNumericString(body.amount);

  if (!amount) return new Response("amount must be > 0", { status: 400 });

  const method = String(body.method ?? "")
    .trim()
    .toUpperCase();

  if (!methods.has(method)) {
    return new Response("invalid method", { status: 400 });
  }

  const status = String(body.status ?? "PENDIENTE")
    .trim()
    .toUpperCase();

  if (!statuses.has(status)) {
    return new Response("invalid status", { status: 400 });
  }

  const proofImageUrl =
    body.proofImageUrl === undefined || body.proofImageUrl === null
      ? null
      : String(body.proofImageUrl).trim() || null;

  const created = await db.transaction(async (tx) => {
    const [o] = await tx
      .select({ id: orders.id, orderCode: orders.orderCode })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!o) throw new Error("order not found");

    const [p] = await tx
      .insert(orderPayments)
      .values({
        orderId,
        amount,
        method: method as any,
        status: status as any,
        proofImageUrl,
      })
      .returning();

    return { payment: p, orderCode: o.orderCode };
  });

  await createNotificationsForPermission("VER_PAGO", {
    title: "Pago registrado",
    message: `Se registró un pago para el pedido ${created.orderCode}.`,
    href: `/orders/${orderId}/payments`,
  });

  return Response.json(created.payment, { status: 201 });
}
