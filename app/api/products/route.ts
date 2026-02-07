import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { products } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "products:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products);

  const items = await db.select().from(products).limit(pageSize).offset(offset);
  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "products:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const { name, description, categoryId, isActive } = await request.json();

  const n = String(name ?? "").trim();

  if (!n) {
    return new Response("name required", { status: 400 });
  }

  const created = await db
    .insert(products)
    .values({
      name: n,
      description: description ? String(description) : null,
      categoryId: categoryId ? String(categoryId) : null,
      isActive: isActive ?? true,
    })
    .returning();

  return Response.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "products:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const { id, name, description, categoryId, isActive } = await request.json();

  if (!id) {
    return new Response("Product ID required", { status: 400 });
  }

  const patch: Partial<typeof products.$inferInsert> = {
    isActive,
  };

  if (name !== undefined) patch.name = String(name).trim();
  if (description !== undefined)
    patch.description = description ? String(description) : null;
  if (categoryId !== undefined)
    patch.categoryId = categoryId ? String(categoryId) : null;

  const updated = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, String(id)))
    .returning();

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "products:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "ELIMINAR_ITEM_INVENTARIO",
  );

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Product ID required", { status: 400 });
  }

  try {
    const deleted = await db
      .delete(products)
      .where(eq(products.id, String(id)))
      .returning();

    return Response.json(deleted);
  } catch {
    return new Response(
      "No se pudo eliminar. Verifica si el producto tiene precios u órdenes asociadas.",
      { status: 409 },
    );
  }
}
