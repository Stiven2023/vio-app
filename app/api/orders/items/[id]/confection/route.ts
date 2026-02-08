import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/src/db";
import { confectionists, orderItemConfection } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-confection:get",
    limit: 240,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderItemId = String(id ?? "").trim();

  if (!orderItemId) return new Response("id required", { status: 400 });

  const [assignment] = await db
    .select({
      id: orderItemConfection.id,
      orderItemId: orderItemConfection.orderItemId,
      confectionistId: orderItemConfection.confectionistId,
      confectionistName: confectionists.name,
      assignedAt: orderItemConfection.assignedAt,
      finishedAt: orderItemConfection.finishedAt,
    })
    .from(orderItemConfection)
    .leftJoin(
      confectionists,
      eq(orderItemConfection.confectionistId, confectionists.id),
    )
    .where(
      and(
        eq(orderItemConfection.orderItemId, orderItemId),
        isNull(orderItemConfection.finishedAt),
      ),
    )
    .orderBy(desc(orderItemConfection.assignedAt))
    .limit(1);

  const options = await db
    .select({ id: confectionists.id, name: confectionists.name })
    .from(confectionists)
    .where(eq(confectionists.isActive, true))
    .orderBy(desc(confectionists.name));

  return Response.json({ assignment: assignment ?? null, options });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-confection:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ASIGNAR_CONFECCIONISTA");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderItemId = String(id ?? "").trim();

  if (!orderItemId) return new Response("id required", { status: 400 });

  const { confectionistId } = await request.json();
  const cid = String(confectionistId ?? "").trim();

  if (!cid) return new Response("confectionistId required", { status: 400 });

  const created = await db.transaction(async (tx) => {
    await tx
      .update(orderItemConfection)
      .set({ finishedAt: new Date() })
      .where(
        and(
          eq(orderItemConfection.orderItemId, orderItemId),
          isNull(orderItemConfection.finishedAt),
        ),
      );

    const inserted = await tx
      .insert(orderItemConfection)
      .values({
        orderItemId,
        confectionistId: cid,
      })
      .returning();

    return inserted;
  });

  return Response.json(created, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-confection:delete",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ASIGNAR_CONFECCIONISTA");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderItemId = String(id ?? "").trim();

  if (!orderItemId) return new Response("id required", { status: 400 });

  const updated = await db
    .update(orderItemConfection)
    .set({ finishedAt: new Date() })
    .where(
      and(
        eq(orderItemConfection.orderItemId, orderItemId),
        isNull(orderItemConfection.finishedAt),
      ),
    )
    .returning();

  return Response.json(updated);
}
