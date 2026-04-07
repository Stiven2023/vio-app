import { desc, eq, inArray, or } from "drizzle-orm";

import { mesDb } from "@/src/db";
import {
  cashReceipts,
  clients,
  orderPayments,
  orders,
  prefacturas,
} from "@/src/db/erp/schema";
import { mesShipments } from "@/src/db/mes/schema";
import { accountingEntries } from "@/src/db/schema";
import {
  dbJsonError,
  jsonError,
  jsonNotFound,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { assertAdvisorOwnsOrder } from "@/src/utils/advisor-scope";
import { orderHistoryParamsSchema } from "@/src/utils/accounting-traceability-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { db } from "@/src/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "orders:history:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const parsedParams = orderHistoryParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return zodFirstErrorEnvelope(
      parsedParams.error,
      "Los parámetros del pedido son inválidos.",
    );
  }

  const { id: orderId } = parsedParams.data;

  const advisorForbidden = await assertAdvisorOwnsOrder(request, orderId);

  if (advisorForbidden) return advisorForbidden;

  try {
    const [order] = await db
      .select({
        id: orders.id,
        orderCode: orders.orderCode,
        status: orders.status,
        clientId: orders.clientId,
        clientName: clients.name,
        total: orders.total,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order?.id) {
      return jsonNotFound("El pedido no existe.");
    }

    const [payments, preInvoiceRows, receiptRows, shipments] =
      await Promise.all([
        db
          .select({
            id: orderPayments.id,
            amount: orderPayments.amount,
            depositAmount: orderPayments.depositAmount,
            method: orderPayments.method,
            status: orderPayments.status,
            referenceCode: orderPayments.referenceCode,
            createdAt: orderPayments.createdAt,
          })
          .from(orderPayments)
          .where(eq(orderPayments.orderId, orderId))
          .orderBy(desc(orderPayments.createdAt)),
        db
          .select({
            id: prefacturas.id,
            prefacturaCode: prefacturas.prefacturaCode,
            status: prefacturas.status,
            total: prefacturas.total,
            siigoStatus: prefacturas.siigoStatus,
            createdAt: prefacturas.createdAt,
          })
          .from(prefacturas)
          .where(eq(prefacturas.orderId, orderId))
          .orderBy(desc(prefacturas.createdAt)),
        db
          .select({
            id: cashReceipts.id,
            receiptCode: cashReceipts.receiptCode,
            status: cashReceipts.status,
            amountReceived: cashReceipts.amountReceived,
            paymentMethod: cashReceipts.paymentMethod,
            receiptDate: cashReceipts.receiptDate,
            createdAt: cashReceipts.createdAt,
          })
          .from(cashReceipts)
          .where(eq(cashReceipts.orderId, orderId))
          .orderBy(desc(cashReceipts.createdAt)),
        mesDb
          .select({
            id: mesShipments.id,
            shipmentCode: mesShipments.guiaNumero,
            status: mesShipments.status,
            deliveredAt: mesShipments.llegadaAt,
            createdAt: mesShipments.createdAt,
          })
          .from(mesShipments)
          .where(eq(mesShipments.orderId, orderId))
          .orderBy(desc(mesShipments.createdAt)),
      ]);

    const sourceIds = [
      orderId,
      ...payments.map((payment) => payment.id),
      ...preInvoiceRows.map((pf) => pf.id),
      ...receiptRows.map((receipt) => receipt.id),
    ];

    const uniqueSourceIds = Array.from(new Set(sourceIds.filter(Boolean)));

    const accounting = uniqueSourceIds.length
      ? await db
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
            createdAt: accountingEntries.createdAt,
          })
          .from(accountingEntries)
          .where(
            or(
              eq(accountingEntries.sourceId, orderId),
              inArray(accountingEntries.sourceId, uniqueSourceIds),
            ),
          )
          .orderBy(
            desc(accountingEntries.entryDate),
            desc(accountingEntries.createdAt),
          )
      : [];

    return Response.json({
      order,
      payments,
      prefacturas: preInvoiceRows,
      cashReceipts: receiptRows,
      mesShipments: shipments,
      accountingEntries: accounting,
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo consultar el historial del pedido.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo consultar el historial del pedido.",
    );
  }
}
