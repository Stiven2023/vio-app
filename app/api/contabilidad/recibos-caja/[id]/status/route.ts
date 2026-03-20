import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  cashReceiptApplications,
  cashReceipts,
  prefacturas,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type NextStatus = "CONFIRMED" | "VOIDED";

function prefacturaAmountExpr() {
  return sql`case when coalesce(${prefacturas.totalAfterWithholdings}, 0) > 0 then coalesce(${prefacturas.totalAfterWithholdings}, 0) else coalesce(${prefacturas.total}, 0) end`;
}

async function getOutstandingBalances(prefacturaIds: string[]) {
  if (prefacturaIds.length === 0) return new Map<string, number>();

  const totalExpr = prefacturaAmountExpr();
  const rows = await db
    .select({
      id: prefacturas.id,
      total: totalExpr,
      applied: sql<string>`coalesce(sum(case when ${cashReceipts.status} = 'CONFIRMED' then ${cashReceiptApplications.appliedAmount} else 0 end), 0)::text`,
    })
    .from(prefacturas)
    .leftJoin(
      cashReceiptApplications,
      eq(cashReceiptApplications.prefacturaId, prefacturas.id),
    )
    .leftJoin(
      cashReceipts,
      eq(cashReceiptApplications.cashReceiptId, cashReceipts.id),
    )
    .where(inArray(prefacturas.id, prefacturaIds))
    .groupBy(prefacturas.id);

  return new Map(
    rows.map((row) => {
      const total = Number(row.total ?? 0);
      const applied = Number(row.applied ?? 0);

      return [row.id, Math.max(0, total - applied)];
    }),
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "cash-receipts:status:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  try {
    const { id } = await context.params;
    const receiptId = String(id ?? "").trim();
    const body = await request.json();
    const status = String(body?.status ?? "")
      .trim()
      .toUpperCase() as NextStatus;

    if (!receiptId) return new Response("id required", { status: 400 });
    if (status !== "CONFIRMED" && status !== "VOIDED") {
      return new Response("status invalid", { status: 400 });
    }

    const forbidden = await requirePermission(
      request,
      status === "VOIDED" ? "ANULAR_RECIBO_CAJA" : "CREAR_RECIBO_CAJA",
    );

    if (forbidden) return forbidden;

    const [receipt] = await db
      .select({
        id: cashReceipts.id,
        status: cashReceipts.status,
        amountReceived: cashReceipts.amountReceived,
      })
      .from(cashReceipts)
      .where(eq(cashReceipts.id, receiptId))
      .limit(1);

    if (!receipt?.id) {
      return new Response("Recibo no encontrado", { status: 404 });
    }

    if (String(receipt.status ?? "") === status) {
      return new Response("El recibo ya tiene ese estado", { status: 409 });
    }

    if (String(receipt.status ?? "") === "VOIDED" && status === "CONFIRMED") {
      return new Response("No se puede confirmar un recibo anulado", {
        status: 409,
      });
    }

    const applications = await db
      .select({
        prefacturaId: cashReceiptApplications.prefacturaId,
        appliedAmount: cashReceiptApplications.appliedAmount,
      })
      .from(cashReceiptApplications)
      .where(eq(cashReceiptApplications.cashReceiptId, receiptId));

    if (status === "CONFIRMED") {
      const prefacturaIds = applications
        .map((item) => String(item.prefacturaId ?? "").trim())
        .filter(Boolean);
      const outstandingByPrefactura =
        await getOutstandingBalances(prefacturaIds);

      for (const application of applications) {
        const prefacturaId = String(application.prefacturaId ?? "").trim();
        const amount = Number(application.appliedAmount ?? 0);
        const outstanding = outstandingByPrefactura.get(prefacturaId) ?? 0;

        if (amount > outstanding + 0.0001) {
          return new Response(
            "No se puede confirmar: una aplicacion excede el saldo pendiente actual",
            { status: 409 },
          );
        }
      }
    }

    const [updated] = await db
      .update(cashReceipts)
      .set({ status })
      .where(eq(cashReceipts.id, receiptId))
      .returning({ id: cashReceipts.id, status: cashReceipts.status });

    return Response.json({ ok: true, id: updated.id, status: updated.status });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar el estado del recibo", {
      status: 500,
    });
  }
}
