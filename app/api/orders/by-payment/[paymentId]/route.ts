import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, orderPayments, orders } from "@/src/db/erp/schema";
import { accountingEntries } from "@/src/db/schema";
import {
  dbJsonError,
  jsonError,
  jsonNotFound,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { orderByPaymentParamsSchema } from "@/src/utils/accounting-traceability-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const limited = rateLimit(request, {
    key: "orders:by-payment:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGO");

  if (forbidden) return forbidden;

  const parsedParams = orderByPaymentParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return zodFirstErrorEnvelope(
      parsedParams.error,
      "Los parámetros del pago son inválidos.",
    );
  }

  const { paymentId: pid } = parsedParams.data;

  try {
    const [payment] = await db
      .select({
        id: orderPayments.id,
        orderId: orderPayments.orderId,
        orderCode: orders.orderCode,
        orderStatus: orders.status,
        clientId: orders.clientId,
        clientName: clients.name,
        amount: orderPayments.amount,
        depositAmount: orderPayments.depositAmount,
        method: orderPayments.method,
        status: orderPayments.status,
        referenceCode: orderPayments.referenceCode,
        createdAt: orderPayments.createdAt,
      })
      .from(orderPayments)
      .leftJoin(orders, eq(orderPayments.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(eq(orderPayments.id, pid))
      .limit(1);

    if (!payment?.id) {
      return jsonNotFound("Pago no encontrado.");
    }

    const accounting = await db
      .select({
        id: accountingEntries.id,
        entryNumber: accountingEntries.entryNumber,
        status: accountingEntries.status,
        sourceModule: accountingEntries.sourceModule,
        sourceType: accountingEntries.sourceType,
        sourceId: accountingEntries.sourceId,
        description: accountingEntries.description,
        period: accountingEntries.period,
        totalDebit: accountingEntries.totalDebit,
        totalCredit: accountingEntries.totalCredit,
        entryDate: accountingEntries.entryDate,
        postedAt: accountingEntries.postedAt,
      })
      .from(accountingEntries)
      .where(eq(accountingEntries.sourceId, pid))
      .orderBy(
        desc(accountingEntries.entryDate),
        desc(accountingEntries.createdAt),
      );

    return Response.json({
      payment,
      order: payment.orderId
        ? {
            id: payment.orderId,
            orderCode: payment.orderCode,
            status: payment.orderStatus,
            clientId: payment.clientId,
            clientName: payment.clientName,
          }
        : null,
      accountingEntries: accounting,
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo consultar el pedido del pago.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo consultar el pedido del pago.",
    );
  }
}
