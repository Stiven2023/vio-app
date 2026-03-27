/**
 * GET  /api/mes/item-tags?orderItemId=<uuid>  — list tags for a design
 * POST /api/mes/item-tags                      — add a tag to a design
 * DELETE /api/mes/item-tags?id=<uuid>          — remove a tag
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { mesItemTags } from "@/src/db/schema";
import { mesItemTagValues } from "@/src/db/enums";
import { requirePermission } from "@/src/utils/permission-middleware";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:item-tags:get",
    limit: 300,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MES");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const orderItemId = String(searchParams.get("orderItemId") ?? "").trim();

  if (!orderItemId)
    return new Response("orderItemId required", { status: 400 });

  const rows = await db
    .select()
    .from(mesItemTags)
    .where(eq(mesItemTags.orderItemId, orderItemId));

  return Response.json({ items: rows });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:item-tags:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MES");

  if (forbidden) return forbidden;

  const body = await request.json();
  const orderItemId = String(body?.orderItemId ?? "").trim();
  const orderId = String(body?.orderId ?? "").trim();
  const tag = String(body?.tag ?? "")
    .toUpperCase()
    .trim();
  const notes = String(body?.notes ?? "").trim() || null;

  if (!orderItemId) return new Response("orderItemId required", { status: 400 });
  if (!orderId) return new Response("orderId required", { status: 400 });
  if (!(mesItemTagValues as readonly string[]).includes(tag)) {
    return new Response(`Invalid tag. Valid: ${mesItemTagValues.join(", ")}`, {
      status: 400,
    });
  }

  const employeeId = getEmployeeIdFromRequest(request);

  // Upsert: if already exists, just update notes
  const existing = await db
    .select({ id: mesItemTags.id })
    .from(mesItemTags)
    .where(
      and(
        eq(mesItemTags.orderItemId, orderItemId),
        eq(mesItemTags.tag, tag as any),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(mesItemTags)
      .set({ notes })
      .where(eq(mesItemTags.id, existing[0]!.id));

    return Response.json({ id: existing[0]!.id, updated: true });
  }

  const [inserted] = await db
    .insert(mesItemTags)
    .values({
      orderId,
      orderItemId,
      tag: tag as any,
      notes,
      setBy: employeeId,
    })
    .returning({ id: mesItemTags.id });

  return Response.json({ id: inserted?.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:item-tags:delete",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MES");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const id = String(searchParams.get("id") ?? "").trim();

  if (!id) return new Response("id required", { status: 400 });

  await db.delete(mesItemTags).where(eq(mesItemTags.id, id));

  return new Response(null, { status: 204 });
}
