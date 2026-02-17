import { desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { inventoryItems } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-items:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();

    const where = q ? ilike(inventoryItems.name, `%${q}%`) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(inventoryItems)
      .where(where);

    const items = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        description: inventoryItems.description,
        unit: inventoryItems.unit,
        price: inventoryItems.price,
        supplierId: inventoryItems.supplierId,
        minStock: inventoryItems.minStock,
        isActive: inventoryItems.isActive,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
      })
      .from(inventoryItems)
      .where(where)
      .orderBy(desc(inventoryItems.name))
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar inventario", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-items:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const { name, unit, description, price, supplierId, minStock, isActive } =
    await request.json();

  const n = String(name ?? "").trim();
  const u = String(unit ?? "").trim();
  const d = description !== undefined ? String(description ?? "").trim() : undefined;
  const p = price !== undefined ? String(price ?? "").trim() : undefined;
  const s = supplierId !== undefined ? String(supplierId ?? "").trim() : undefined;
  const ms = minStock !== undefined ? String(minStock ?? "").trim() : undefined;

  if (!n) return new Response("name required", { status: 400 });
  if (!u) return new Response("unit required", { status: 400 });

  if (p && Number.isNaN(Number(p))) {
    return new Response("price invalid", { status: 400 });
  }

  if (ms && Number.isNaN(Number(ms))) {
    return new Response("minStock invalid", { status: 400 });
  }

  const created = await db
    .insert(inventoryItems)
    .values({
      name: n,
      unit: u,
      description: d ? d : null,
      price: p ? p : undefined,
      supplierId: s ? s : null,
      minStock: ms ? ms : undefined,
      isActive: isActive ?? true,
    })
    .returning();

  return Response.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-items:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const { id, name, unit, description, price, supplierId, minStock, isActive } =
    await request.json();

  if (!id) return new Response("Inventory item ID required", { status: 400 });

  const n = String(name ?? "").trim();
  const u = String(unit ?? "").trim();

  const d = description !== undefined ? String(description ?? "").trim() : undefined;
  const p = price !== undefined ? String(price ?? "").trim() : undefined;
  const s = supplierId !== undefined ? String(supplierId ?? "").trim() : undefined;
  const ms = minStock !== undefined ? String(minStock ?? "").trim() : undefined;

  if (!n) return new Response("name required", { status: 400 });
  if (!u) return new Response("unit required", { status: 400 });

  if (p && Number.isNaN(Number(p))) {
    return new Response("price invalid", { status: 400 });
  }

  if (ms && Number.isNaN(Number(ms))) {
    return new Response("minStock invalid", { status: 400 });
  }

  const updated = await db
    .update(inventoryItems)
    .set({
      name: n,
      unit: u,
      description: d !== undefined ? (d ? d : null) : undefined,
      price: p !== undefined ? (p ? p : null) : undefined,
      supplierId: s !== undefined ? (s ? s : null) : undefined,
      minStock: ms !== undefined ? (ms ? ms : null) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.id, String(id)))
    .returning();

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-items:delete",
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

  if (!id) return new Response("Inventory item ID required", { status: 400 });

  try {
    const deleted = await db
      .delete(inventoryItems)
      .where(eq(inventoryItems.id, String(id)))
      .returning();

    return Response.json(deleted);
  } catch {
    return new Response(
      "No se pudo eliminar. Verifica si el item esta en uso.",
      { status: 409 },
    );
  }
}
