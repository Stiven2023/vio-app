import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, orderItems, orderPayments, orders } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "orders:prefactura",
    limit: 300,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("id required", { status: 400 });

  const [orderRow] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      kind: (orders as any).kind,
      sourceOrderId: (orders as any).sourceOrderId,
      sourceOrderCode: sql<
        string | null
      >`(select o2.order_code from orders o2 where o2.id = ${(orders as any).sourceOrderId})`,
      clientId: orders.clientId,
      clientName: clients.name,
      clientNit: clients.identification,
      type: orders.type,
      status: orders.status,
      ivaEnabled: orders.ivaEnabled,
      discount: orders.discount,
      currency: orders.currency,
      shippingFee: (orders as any).shippingFee,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return new Response("Not found", { status: 404 });

  const lines = await db
    .select({
      id: orderItems.id,
      name: orderItems.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const subtotal = lines.reduce((acc, l) => {
    const qty = Number(l.quantity ?? 0);
    const unit = asNumber(l.unitPrice);
    const lineTotal =
      l.totalPrice !== null && l.totalPrice !== undefined
        ? asNumber(l.totalPrice)
        : unit * qty;

    return acc + lineTotal;
  }, 0);

  const discountPercent = Math.min(
    100,
    Math.max(0, asNumber(orderRow.discount)),
  );
  const discountAmount = subtotal * (discountPercent / 100);
  const totalAfterDiscount = subtotal - discountAmount;
  const shippingFee = Math.max(0, asNumber(orderRow.shippingFee));
  const grandTotal = totalAfterDiscount + shippingFee;

  const [paidRow] = await db
    .select({
      paidTotal: sql<string>`coalesce(sum(${orderPayments.amount}), 0)::text`,
    })
    .from(orderPayments)
    .where(
      sql`${orderPayments.orderId} = ${orderId} and ${orderPayments.status} <> 'ANULADO'`,
    )
    .limit(1);

  const paidTotal = Math.max(0, asNumber(paidRow?.paidTotal));
  const paidPercent =
    grandTotal > 0
      ? Math.min(100, Math.max(0, (paidTotal / grandTotal) * 100))
      : 0;
  const remaining = Math.max(0, grandTotal - paidTotal);

  return Response.json({
    order: orderRow,
    lines,
    totals: {
      subtotal,
      discountPercent,
      discountAmount,
      totalAfterDiscount,
      shippingFee,
      grandTotal,
      paidTotal,
      paidPercent,
      remaining,
    },
  });
}
