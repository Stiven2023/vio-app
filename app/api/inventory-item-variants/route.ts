import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryItemVariants,
  inventoryItems,
  stockMovements,
  warehouseStock,
} from "@/src/db/schema";
import { syncInventoryForVariant } from "@/src/utils/inventory-sync";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function sanitizeSku(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "-").slice(0, 50);
}

async function nextVariantSku(itemCode: string) {
  const prefix = sanitizeSku(itemCode || "SKU");

  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(inventoryItemVariants)
    .where(ilike(inventoryItemVariants.sku, `${prefix}-V%`));

  const next = (row?.total ?? 0) + 1;

  return `${prefix}-V${String(next).padStart(3, "0")}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-item-variants:get",
    limit: 240,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_ITEM_INVENTARIO");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const q = String(searchParams.get("q") ?? "").trim();
  const inventoryItemId = String(searchParams.get("inventoryItemId") ?? "").trim();

  const where = and(
    inventoryItemId ? eq(inventoryItemVariants.inventoryItemId, inventoryItemId) : undefined,
    q
      ? sql`${inventoryItemVariants.sku} ilike ${`%${q}%`} or ${inventoryItemVariants.color} ilike ${`%${q}%`} or ${inventoryItemVariants.size} ilike ${`%${q}%`}`
      : undefined,
  );

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(inventoryItemVariants)
    .where(where);

  const items = await db
    .select({
      id: inventoryItemVariants.id,
      inventoryItemId: inventoryItemVariants.inventoryItemId,
      sku: inventoryItemVariants.sku,
      color: inventoryItemVariants.color,
      size: inventoryItemVariants.size,
      description: inventoryItemVariants.description,
      isActive: inventoryItemVariants.isActive,
      createdAt: inventoryItemVariants.createdAt,
      currentStock: sql<string>`coalesce(sum(${warehouseStock.availableQty}), 0)::text`,
    })
    .from(inventoryItemVariants)
    .leftJoin(warehouseStock, eq(warehouseStock.variantId, inventoryItemVariants.id))
    .where(where)
    .groupBy(
      inventoryItemVariants.id,
      inventoryItemVariants.inventoryItemId,
      inventoryItemVariants.sku,
      inventoryItemVariants.color,
      inventoryItemVariants.size,
      inventoryItemVariants.description,
      inventoryItemVariants.isActive,
      inventoryItemVariants.createdAt,
    )
    .orderBy(desc(inventoryItemVariants.createdAt))
    .limit(pageSize)
    .offset(offset);

  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-item-variants:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_ITEM_INVENTARIO");
  if (forbidden) return forbidden;

  const { inventoryItemId, sku, color, size, description, isActive } = await request.json();

  const itemId = String(inventoryItemId ?? "").trim();
  const providedSku = sanitizeSku(String(sku ?? "").trim());
  const c = String(color ?? "").trim();
  const s = String(size ?? "").trim();
  const d = String(description ?? "").trim();

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!providedSku) return new Response("sku required", { status: 400 });

  const [item] = await db
    .select({ id: inventoryItems.id, itemCode: inventoryItems.itemCode })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, itemId))
    .limit(1);

  if (!item) return new Response("inventory item not found", { status: 404 });

  const [existingSku] = await db
    .select({ id: inventoryItemVariants.id })
    .from(inventoryItemVariants)
    .where(eq(inventoryItemVariants.sku, providedSku))
    .limit(1);

  if (existingSku) {
    return new Response("sku already exists", { status: 409 });
  }

  const created = await db
    .insert(inventoryItemVariants)
    .values({
      inventoryItemId: item.id,
      sku: providedSku,
      color: c || null,
      size: s || null,
      description: d || null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    })
    .returning();

  return Response.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-item-variants:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_ITEM_INVENTARIO");
  if (forbidden) return forbidden;

  const { id, sku, color, size, description, isActive } = await request.json();

  const variantId = String(id ?? "").trim();
  const providedSku =
    sku !== undefined ? sanitizeSku(String(sku ?? "").trim()) : undefined;
  if (!variantId) return new Response("id required", { status: 400 });
  if (sku !== undefined && !providedSku) return new Response("sku required", { status: 400 });

  if (providedSku) {
    const [existingSku] = await db
      .select({ id: inventoryItemVariants.id })
      .from(inventoryItemVariants)
      .where(
        and(
          eq(inventoryItemVariants.sku, providedSku),
          sql`${inventoryItemVariants.id} <> ${variantId}`,
        ),
      )
      .limit(1);

    if (existingSku) {
      return new Response("sku already exists", { status: 409 });
    }
  }

  const updated = await db
    .update(inventoryItemVariants)
    .set({
      sku: providedSku,
      color: color !== undefined ? (String(color ?? "").trim() || null) : undefined,
      size: size !== undefined ? (String(size ?? "").trim() || null) : undefined,
      description:
        description !== undefined
          ? (String(description ?? "").trim() || null)
          : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    })
    .where(eq(inventoryItemVariants.id, variantId))
    .returning();

  if (updated[0]?.id) {
    await syncInventoryForVariant(db, updated[0].id);
  }

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-item-variants:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_ITEM_INVENTARIO");
  if (forbidden) return forbidden;

  const { id } = await request.json();
  const variantId = String(id ?? "").trim();

  if (!variantId) return new Response("id required", { status: 400 });

  const [hasStock] = await db
    .select({ id: warehouseStock.id })
    .from(warehouseStock)
    .where(eq(warehouseStock.variantId, variantId))
    .limit(1);

  if (hasStock) {
    return new Response("No se puede eliminar: variante con stock", { status: 409 });
  }

  const [hasMovements] = await db
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(eq(stockMovements.variantId, variantId))
    .limit(1);

  if (hasMovements) {
    return new Response("No se puede eliminar: variante con movimientos", { status: 409 });
  }

  const deleted = await db
    .delete(inventoryItemVariants)
    .where(eq(inventoryItemVariants.id, variantId))
    .returning();

  return Response.json(deleted);
}
