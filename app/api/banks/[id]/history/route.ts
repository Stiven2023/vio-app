import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  banks,
  orderPayments,
  orders,
  purchaseOrders,
  suppliers,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const limited = rateLimit(request, {
    key: "banks:history:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const bankId = String(id ?? "").trim();

  if (!bankId) {
    return new Response("Bank identifier is required", {
      status: 400,
    });
  }

  try {
    const [bank] = await db
      .select({
        id: banks.id,
        code: banks.code,
        name: banks.name,
        accountRef: banks.accountRef,
        isActive: banks.isActive,
        createdAt: banks.createdAt,
        updatedAt: banks.updatedAt,
      })
      .from(banks)
      .where(eq(banks.id, bankId))
      .limit(1);

    if (!bank) return new Response("Bank not found", { status: 404 });

    const [purchaseOrderRows, paymentRows] = await Promise.all([
      db
        .select({
          id: purchaseOrders.id,
          purchaseOrderCode: purchaseOrders.purchaseOrderCode,
          supplierName: suppliers.name,
          total: purchaseOrders.total,
          status: purchaseOrders.status,
          createdAt: purchaseOrders.createdAt,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .where(eq(purchaseOrders.bankId, bank.id))
        .orderBy(desc(purchaseOrders.createdAt)),
      db
        .select({
          id: orderPayments.id,
          orderId: orderPayments.orderId,
          orderCode: orders.orderCode,
          amount: orderPayments.amount,
          depositAmount: orderPayments.depositAmount,
          method: orderPayments.method,
          transferBank: orderPayments.transferBank,
          transferCurrency: orderPayments.transferCurrency,
          referenceCode: orderPayments.referenceCode,
          status: orderPayments.status,
          createdAt: orderPayments.createdAt,
        })
        .from(orderPayments)
        .leftJoin(orders, eq(orderPayments.orderId, orders.id))
        .where(eq(orderPayments.bankId, bank.id))
        .orderBy(desc(orderPayments.createdAt)),
    ]);

    return Response.json({
      bank,
      purchaseOrders: purchaseOrderRows,
      payments: paymentRows,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Failed to fetch bank history", {
      status: 500,
    });
  }
}
