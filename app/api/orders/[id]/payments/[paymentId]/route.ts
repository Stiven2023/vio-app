import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { orderPayments } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function toNullableNumericString(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));

  if (Number.isNaN(n)) return null;

  return String(n);
}

function toPositiveNumericString(v: unknown) {
  const raw = toNullableNumericString(v);
  const n = raw ? Number(raw) : 0;

  if (!Number.isFinite(n) || n <= 0) return null;

  return String(n);
}

const methods = new Set(["EFECTIVO", "TRANSFERENCIA", "CREDITO"]);
const statuses = new Set(["PENDIENTE", "PARCIAL", "PAGADO", "ANULADO"]);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-payments:put",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PAGO");

  if (forbidden) return forbidden;

  const { paymentId } = await params;
  const pid = String(paymentId ?? "").trim();

  if (!pid) return new Response("paymentId required", { status: 400 });

  const body = (await request.json()) as any;

  const patch: Partial<typeof orderPayments.$inferInsert> = {};

  if (body.amount !== undefined) {
    const amount = toPositiveNumericString(body.amount);

    if (!amount) return new Response("amount must be > 0", { status: 400 });

    patch.amount = amount;
  }

  if (body.method !== undefined) {
    const method = String(body.method ?? "")
      .trim()
      .toUpperCase();

    if (!methods.has(method))
      return new Response("invalid method", { status: 400 });

    patch.method = method as any;
  }

  if (body.status !== undefined) {
    const status = String(body.status ?? "")
      .trim()
      .toUpperCase();

    if (!statuses.has(status))
      return new Response("invalid status", { status: 400 });

    patch.status = status as any;
  }

  if (body.proofImageUrl !== undefined) {
    const url =
      body.proofImageUrl === null ? null : String(body.proofImageUrl).trim();

    patch.proofImageUrl = url ? url : null;
  }

  if (Object.keys(patch).length === 0) {
    return new Response("No fields to update", { status: 400 });
  }

  const [updated] = await db
    .update(orderPayments)
    .set(patch)
    .where(eq(orderPayments.id, pid))
    .returning();

  if (!updated) return new Response("Not found", { status: 404 });

  return Response.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-payments:delete",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PAGO");

  if (forbidden) return forbidden;

  const { paymentId } = await params;
  const pid = String(paymentId ?? "").trim();

  if (!pid) return new Response("paymentId required", { status: 400 });

  const [deleted] = await db
    .delete(orderPayments)
    .where(eq(orderPayments.id, pid))
    .returning();

  if (!deleted) return new Response("Not found", { status: 404 });

  return Response.json(deleted);
}
