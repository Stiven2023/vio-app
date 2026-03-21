import { and, desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, orderItems, orderPayments, orders } from "@/src/db/schema";
import { requireExternalAccessActiveClient } from "@/src/utils/external-auth";
import { isConfirmedPaymentStatus } from "@/src/utils/payment-status";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderCode: string }> },
) {
  const { error, payload } = await requireExternalAccessActiveClient(request);

  if (error) return error;

  const { orderCode: rawOrderCode } = await params;
  const orderCode = String(rawOrderCode ?? "")
    .trim()
    .toUpperCase();

  if (!orderCode) {
    return new Response("orderCode requerido", { status: 400 });
  }

  const [order] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      status: orders.status,
      type: orders.type,
      total: orders.total,
      currency: orders.currency,
      shippingFee: orders.shippingFee,
      discount: orders.discount,
      createdAt: orders.createdAt,
      clientCode: clients.clientCode,
      clientName: clients.name,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .where(
      and(
        eq(orders.clientId, payload.clientId),
        eq(orders.orderCode, orderCode),
      ),
    )
    .limit(1);

  if (!order) {
    return new Response("Pedido no encontrado", { status: 404 });
  }

  const items = await db
    .select({
      id: orderItems.id,
      name: orderItems.name,
      quantity: orderItems.quantity,
      status: orderItems.status,
      process: orderItems.process,
      imageUrl: orderItems.imageUrl,
      fabric: orderItems.fabric,
      color: orderItems.color,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
      observations: orderItems.observations,
      createdAt: orderItems.createdAt,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const payments = await db
    .select({
      id: orderPayments.id,
      amount: orderPayments.amount,
      depositAmount: orderPayments.depositAmount,
      method: orderPayments.method,
      status: orderPayments.status,
      referenceCode: orderPayments.referenceCode,
      proofImageUrl: orderPayments.proofImageUrl,
      createdAt: orderPayments.createdAt,
    })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, order.id))
    .orderBy(desc(orderPayments.createdAt))
    .limit(200);

  const subtotal = items.reduce((acc, item) => {
    const directTotal = Number(item.totalPrice ?? "0");

    if (Number.isFinite(directTotal) && directTotal > 0)
      return acc + directTotal;

    const unit = Number(item.unitPrice ?? "0");
    const qty = Number(item.quantity ?? 0);

    return (
      acc +
      (Number.isFinite(unit) ? unit : 0) * (Number.isFinite(qty) ? qty : 0)
    );
  }, 0);

  const discountPercent = Math.max(0, Number(order.discount ?? "0"));
  const discountAmount = subtotal * (discountPercent / 100);
  const totalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const shippingFee = Math.max(0, Number(order.shippingFee ?? "0"));
  const grandTotal = Math.max(
    0,
    Number(order.total ?? "0") || totalAfterDiscount + shippingFee,
  );

  const paidTotal = payments.reduce((acc, payment) => {
    if (!isConfirmedPaymentStatus(payment.status)) return acc;
    const value = Number(payment.amount ?? "0");

    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);

  const remaining = Math.max(0, grandTotal - paidTotal);
  const paidPercent = grandTotal > 0 ? (paidTotal / grandTotal) * 100 : 0;

  return Response.json({
    order,
    items,
    payments,
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
