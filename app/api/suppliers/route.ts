import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { suppliers } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "suppliers:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PROVEEDOR");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(suppliers);

  const items = await db.select().from(suppliers).limit(pageSize).offset(offset);
  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "suppliers:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PROVEEDOR");

  if (forbidden) return forbidden;

  const { name, phone, email, isActive } = await request.json();

  const n = String(name ?? "").trim();

  if (!n) {
    return new Response("name required", { status: 400 });
  }

  const created = await db
    .insert(suppliers)
    .values({
      name: n,
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      isActive: isActive ?? true,
    })
    .returning();

  return Response.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "suppliers:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PROVEEDOR");

  if (forbidden) return forbidden;

  const { id, name, phone, email, isActive } = await request.json();

  if (!id) {
    return new Response("Supplier ID required", { status: 400 });
  }

  const patch: Partial<typeof suppliers.$inferInsert> = { isActive };

  if (name !== undefined) patch.name = String(name).trim();
  if (phone !== undefined) patch.phone = phone ? String(phone).trim() : null;
  if (email !== undefined) patch.email = email ? String(email).trim() : null;

  const updated = await db
    .update(suppliers)
    .set(patch)
    .where(eq(suppliers.id, String(id)))
    .returning();

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "suppliers:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_PROVEEDOR");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Supplier ID required", { status: 400 });
  }

  const deleted = await db
    .delete(suppliers)
    .where(eq(suppliers.id, String(id)))
    .returning();

  return Response.json(deleted);
}
