import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  cashReceiptApplications,
  cashReceipts,
  preInvoices,
} from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function prefacturaAmountExpr() {
  return sql`case when coalesce(${preInvoices.totalAfterWithholdings}, 0) > 0 then coalesce(${preInvoices.totalAfterWithholdings}, 0) else coalesce(${preInvoices.total}, 0) end`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "cash-receipts:options:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_RECIBO_CAJA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const clientId = String(searchParams.get("clientId") ?? "").trim();

    if (!clientId) return Response.json({ items: [] });

    const totalExpr = prefacturaAmountExpr();
    const rows = await db
      .select({
        id: preInvoices.id,
        prefacturaCode: preInvoices.prefacturaCode,
        orderId: preInvoices.orderId,
        total: totalExpr,
        applied: sql<string>`coalesce(sum(case when ${cashReceipts.status} = 'CONFIRMED' then ${cashReceiptApplications.appliedAmount} else 0 end), 0)::text`,
      })
      .from(preInvoices)
      .leftJoin(
        cashReceiptApplications,
        eq(cashReceiptApplications.prefacturaId, preInvoices.id),
      )
      .leftJoin(
        cashReceipts,
        eq(cashReceiptApplications.cashReceiptId, cashReceipts.id),
      )
      .where(eq(preInvoices.clientId, clientId))
      .groupBy(preInvoices.id)
      .orderBy(asc(preInvoices.prefacturaCode));

    return Response.json({
      items: rows
        .map((row) => {
          const total = Number(row.total ?? 0);
          const applied = Number(row.applied ?? 0);
          const remaining = Math.max(0, total - applied);

          return {
            id: row.id,
            prefacturaCode: row.prefacturaCode,
            orderId: row.orderId,
            total: String(total),
            applied: String(applied),
            remaining: String(remaining),
          };
        })
        .filter((row) => Number(row.remaining) > 0),
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar las prefacturas abiertas", {
      status: 500,
    });
  }
}
