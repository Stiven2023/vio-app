import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  cashReceipts,
  clients,
  orderPayments,
  orders,
  prefacturas,
} from "@/src/db/erp/schema";
import { accountingEntries } from "@/src/db/schema";
import {
  dbJsonError,
  jsonError,
  jsonNotFound,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { accountingEntrySourceByIdParamsSchema } from "@/src/utils/accounting-traceability-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

async function resolveEntrySource(sourceType: string, sourceId: string) {
  if (sourceType === "ORDER_PAYMENT") {
    const [payment] = await db
      .select({
        paymentId: orderPayments.id,
        orderId: orderPayments.orderId,
        orderCode: orders.orderCode,
        clientId: orders.clientId,
        clientName: clients.name,
        amount: orderPayments.amount,
        status: orderPayments.status,
        method: orderPayments.method,
        referenceCode: orderPayments.referenceCode,
        createdAt: orderPayments.createdAt,
      })
      .from(orderPayments)
      .leftJoin(orders, eq(orderPayments.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(eq(orderPayments.id, sourceId))
      .limit(1);

    return payment ?? null;
  }

  if (sourceType === "CASH_RECEIPT") {
    const [receipt] = await db
      .select({
        receiptId: cashReceipts.id,
        receiptCode: cashReceipts.receiptCode,
        orderId: cashReceipts.orderId,
        prefacturaId: cashReceipts.prefacturaId,
        clientId: cashReceipts.clientId,
        clientName: clients.name,
        amountReceived: cashReceipts.amountReceived,
        status: cashReceipts.status,
        receiptDate: cashReceipts.receiptDate,
      })
      .from(cashReceipts)
      .leftJoin(clients, eq(cashReceipts.clientId, clients.id))
      .where(eq(cashReceipts.id, sourceId))
      .limit(1);

    return receipt ?? null;
  }

  if (sourceType === "PREFACTURA_INVOICED") {
    const [pf] = await db
      .select({
        prefacturaId: prefacturas.id,
        prefacturaCode: prefacturas.prefacturaCode,
        orderId: prefacturas.orderId,
        clientId: prefacturas.clientId,
        clientName: clients.name,
        total: prefacturas.total,
        subtotal: prefacturas.subtotal,
        ivaAmount: prefacturas.ivaAmount,
        status: prefacturas.status,
      })
      .from(prefacturas)
      .leftJoin(clients, eq(prefacturas.clientId, clients.id))
      .where(eq(prefacturas.id, sourceId))
      .limit(1);

    return pf ?? null;
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "contabilidad:asientos:source-by-id:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CONTABILIDAD");

  if (forbidden) return forbidden;

  const parsedParams = accountingEntrySourceByIdParamsSchema.safeParse(
    await params,
  );

  if (!parsedParams.success) {
    return zodFirstErrorEnvelope(
      parsedParams.error,
      "Los parámetros del asiento son inválidos.",
    );
  }

  const { id: entryId } = parsedParams.data;

  try {
    const [entry] = await db
      .select({
        id: accountingEntries.id,
        entryNumber: accountingEntries.entryNumber,
        sourceModule: accountingEntries.sourceModule,
        sourceType: accountingEntries.sourceType,
        sourceId: accountingEntries.sourceId,
        status: accountingEntries.status,
        period: accountingEntries.period,
        entryDate: accountingEntries.entryDate,
        totalDebit: accountingEntries.totalDebit,
        totalCredit: accountingEntries.totalCredit,
      })
      .from(accountingEntries)
      .where(eq(accountingEntries.id, entryId))
      .limit(1);

    if (!entry?.id) {
      return jsonNotFound("El asiento contable no existe.");
    }

    const sourceType = String(entry.sourceType ?? "").toUpperCase();
    const sourceId = String(entry.sourceId ?? "").trim();
    const source =
      sourceType && sourceId
        ? await resolveEntrySource(sourceType, sourceId)
        : null;

    return Response.json({
      entry,
      sourceType,
      sourceId,
      source,
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo consultar el origen del asiento.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo consultar el origen del asiento.",
    );
  }
}
