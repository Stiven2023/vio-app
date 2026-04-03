import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { confectionistPaymentRequests, orderItemConfection } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type CreateBody = {
  orderItemConfectionId?: unknown;
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
      maxSuffix: sql<number>`max((substring(${confectionistPaymentRequests.requestCode} from '(?i)^CPR([0-9]+)$')::int))`,
    })
    .from(confectionistPaymentRequests)
    .where(sql`${confectionistPaymentRequests.requestCode} ~* '^CPR[0-9]+$'`)
    .limit(1);

  const next = (row?.maxSuffix ?? 10000) + 1;

  return `CPR${String(next).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:payment-requests:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGOS_CONFECCION");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? null;

    const rows = await db
      .select()
      .from(confectionistPaymentRequests)
      .where(
        status ? eq(confectionistPaymentRequests.status, status) : undefined,
      )
      .orderBy(desc(confectionistPaymentRequests.requestedAt));

    return Response.json({ items: rows });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar solicitudes", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:payment-requests:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PAGO_CONFECCION");

  if (forbidden) return forbidden;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateBody;
    const orderItemConfectionId = str(body.orderItemConfectionId);
    const amount = toPositiveDecimal(body.amount);

    const errors: Record<string, string[]> = {};

    if (!orderItemConfectionId)
      errors.orderItemConfectionId = ["ID de confección requerido."];
    if (!amount) errors.amount = ["Monto inválido."];

    if (Object.keys(errors).length > 0) {
      return Response.json({ errors }, { status: 422 });
    }

    const employeeId = getEmployeeIdFromRequest(request);

    const created = await db.transaction(async (tx) => {
      // Verify the confection item exists
      const [confectionItem] = await tx
        .select({ id: orderItemConfection.id })
        .from(orderItemConfection)
        .where(eq(orderItemConfection.id, orderItemConfectionId))
        .limit(1);

      if (!confectionItem) return { kind: "not-found" as const };

      const requestCode = await nextRequestCode(tx);

      const [row] = await tx
        .insert(confectionistPaymentRequests)
        .values({
          requestCode,
          orderItemConfectionId,
          amount: amount!,
          status: "PENDIENTE",
          notes: str(body.notes) || null,
          requestedBy: employeeId,
        })
        .returning({ id: confectionistPaymentRequests.id, requestCode: confectionistPaymentRequests.requestCode });

      return { kind: "ok" as const, id: row.id, requestCode: row.requestCode };
    });

    if (created.kind === "not-found") {
      return new Response("Confección no encontrada", { status: 404 });
    }

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear la solicitud", { status: 500 });
  }
}
