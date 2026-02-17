import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { confectionists } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CONFECCIONISTA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(confectionists);

    const items = await db
      .select()
      .from(confectionists)
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar confeccionistas", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_CONFECCIONISTA");

  if (forbidden) return forbidden;

  const { name, type, phone, isActive } = await request.json();

  const n = String(name ?? "").trim();

  if (!n) {
    return new Response("name required", { status: 400 });
  }

  const created = await db
    .insert(confectionists)
    .values({
      name: n,
      type: type ? String(type).trim() : null,
      phone: phone ? String(phone).trim() : null,
      isActive: isActive ?? true,
    })
    .returning();

  return Response.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_CONFECCIONISTA");

  if (forbidden) return forbidden;

  const { id, name, type, phone, isActive } = await request.json();

  if (!id) {
    return new Response("Confectionist ID required", { status: 400 });
  }

  const patch: Partial<typeof confectionists.$inferInsert> = { isActive };

  if (name !== undefined) patch.name = String(name).trim();
  if (type !== undefined) patch.type = type ? String(type).trim() : null;
  if (phone !== undefined) patch.phone = phone ? String(phone).trim() : null;

  const updated = await db
    .update(confectionists)
    .set(patch)
    .where(eq(confectionists.id, String(id)))
    .returning();

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_CONFECCIONISTA");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Confectionist ID required", { status: 400 });
  }

  const deleted = await db
    .delete(confectionists)
    .where(eq(confectionists.id, String(id)))
    .returning();

  return Response.json(deleted);
}
