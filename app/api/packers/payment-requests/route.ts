import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { orderItemPacker, packerPaymentRequests } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type CreateBody = {
  orderItemPackerId?: unknown;
  amount?: unknown;
  notes?: unknown;
};

function str(value: unknown) {
  return String(value ?? "").trim();
}

function toPositiveDecimal(value: unknown): string | null {
  const num = Number(String(value ?? "").replace(/,/g, "."));

  if (!Number.isFinite(num) || num <= 0) return null;

  return num.toFixed(2);
}

async function nextRequestCode(tx: any) {
  const [row] = await tx
    .select({
      maxSuffix: sql<number>`max((substring(${packerPaymentRequests.requestCode} from '(?i)^PPR([0-9]+)$')::int))`,
    })
    .from(packerPaymentRequests)
    .where(sql`${packerPaymentRequests.requestCode} ~* '^PPR[0-9]+$'`)
    .limit(1);

  const next = (row?.maxSuffix ?? 10000) + 1;

  return `PPR${String(next).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "packers:payment-requests:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGOS_EMPAQUE");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? null;

    const rows = await db
      .select()
      .from(packerPaymentRequests)
      .where(status ? eq(packerPaymentRequests.status, status) : undefined)
      .orderBy(desc(packerPaymentRequests.requestedAt));

    return Response.json({ items: rows });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar solicitudes", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "packers:payment-requests:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PAGO_EMPAQUE");

  if (forbidden) return forbidden;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateBody;
    const orderItemPackerId = str(body.orderItemPackerId);
    const amount = toPositiveDecimal(body.amount);

    const errors: Record<string, string[]> = {};

    if (!orderItemPackerId) errors.orderItemPackerId = ["ID de empaque requerido."];
    if (!amount) errors.amount = ["Monto inválido."];

    if (Object.keys(errors).length > 0) {
      return Response.json({ errors }, { status: 422 });
    }

    const employeeId = getEmployeeIdFromRequest(request);

    const created = await db.transaction(async (tx) => {
      const [packerItem] = await tx
        .select({ id: orderItemPacker.id })
        .from(orderItemPacker)
        .where(eq(orderItemPacker.id, orderItemPackerId))
        .limit(1);

      if (!packerItem) return { kind: "not-found" as const };

      const requestCode = await nextRequestCode(tx);

      const [row] = await tx
        .insert(packerPaymentRequests)
        .values({
          requestCode,
          orderItemPackerId,
          amount: amount!,
          status: "PENDIENTE",
          notes: str(body.notes) || null,
          requestedBy: employeeId,
        })
        .returning({ id: packerPaymentRequests.id, requestCode: packerPaymentRequests.requestCode });

      return { kind: "ok" as const, id: row.id, requestCode: row.requestCode };
    });

    if (created.kind === "not-found") {
      return new Response("Empaque no encontrado", { status: 404 });
    }

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear la solicitud", { status: 500 });
  }
}
