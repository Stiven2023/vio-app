import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryCategories,
  inventoryItems,
  stockMovements,
  warehouseStock,
  warehouses,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { ensureInventoryBaseData, resolveWarehouseIdByLocation } from "@/src/utils/inventory-sync";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

const CATEGORY_PREFIX: Record<string, string> = {
  INSUMOS_PRODUCCION: "INS",
  PAPELERIA: "PAP",
  ASEO: "ASE",
  REPUESTOS: "REP",
  REVENTA: "REV",
};

function sanitizeCode(value: string) {
  return value.replace(/[^A-Z0-9]/g, "");
}

async function resolveCategoryId(
  dbOrTx: any,
  categoryType?: unknown,
) {
  await ensureInventoryBaseData(dbOrTx);

  const normalized = String(categoryType ?? "INSUMOS_PRODUCCION")
    .trim()
    .toUpperCase();

  const [categoryRow] = await dbOrTx
    .select({ id: inventoryCategories.id, type: inventoryCategories.type })
    .from(inventoryCategories)
    .where(eq(inventoryCategories.type, normalized as typeof inventoryCategories.$inferSelect.type))
    .limit(1);

  if (categoryRow) {
    return categoryRow;
  }

  const [fallback] = await dbOrTx
    .select({ id: inventoryCategories.id, type: inventoryCategories.type })
    .from(inventoryCategories)
    .where(eq(inventoryCategories.type, "INSUMOS_PRODUCCION"))
    .limit(1);

  return fallback ?? null;
}

async function nextItemCode(dbOrTx: any, categoryType: string) {
  const prefix = CATEGORY_PREFIX[categoryType] ?? "INV";

  const [row] = await dbOrTx
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(inventoryItems)
    .where(sql`${inventoryItems.itemCode} like ${`${prefix}-%`}`);

  const next = (row?.total ?? 0) + 1;

  return `${sanitizeCode(prefix)}-${String(next).padStart(4, "0")}`;
}

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
        itemCode: inventoryItems.itemCode,
        name: inventoryItems.name,
        description: inventoryItems.description,
        unit: inventoryItems.unit,
        price: inventoryItems.price,
        supplierId: inventoryItems.supplierId,
        categoryId: inventoryItems.categoryId,
        hasVariants: inventoryItems.hasVariants,
        currentStock: sql<string>`coalesce(sum(${warehouseStock.availableQty}), 0)::text`,
        minStock: sql<string>`coalesce(max(case when ${warehouses.code} = 'BODEGA_PRINCIPAL' then ${warehouseStock.minStock} end), '0')::text`,
        lastMovementType: sql<"ENTRADA" | "SALIDA" | null>`(
          case
            when max(case when ${stockMovements.movementType} = 'ENTRADA' then ${stockMovements.createdAt} end) is null
             and max(case when ${stockMovements.movementType} = 'SALIDA' then ${stockMovements.createdAt} end) is null
              then null
            when coalesce(
              max(case when ${stockMovements.movementType} = 'ENTRADA' then ${stockMovements.createdAt} end),
              to_timestamp(0)
            ) >= coalesce(
              max(case when ${stockMovements.movementType} = 'SALIDA' then ${stockMovements.createdAt} end),
              to_timestamp(0)
            ) then 'ENTRADA'
            else 'SALIDA'
          end
        )`,
        isActive: inventoryItems.isActive,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
      })
      .from(inventoryItems)
      .leftJoin(warehouseStock, eq(warehouseStock.inventoryItemId, inventoryItems.id))
      .leftJoin(stockMovements, eq(stockMovements.inventoryItemId, inventoryItems.id))
      .leftJoin(warehouses, eq(warehouseStock.warehouseId, warehouses.id))
      .where(where)
      .groupBy(
        inventoryItems.id,
        inventoryItems.itemCode,
        inventoryItems.name,
        inventoryItems.description,
        inventoryItems.unit,
        inventoryItems.price,
        inventoryItems.supplierId,
        inventoryItems.categoryId,
        inventoryItems.hasVariants,
        inventoryItems.isActive,
        inventoryItems.createdAt,
        inventoryItems.updatedAt,
      )
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

  const {
    name,
    unit,
    description,
    price,
    supplierId,
    minStock,
    isActive,
    categoryType,
    hasVariants,
  } = await request.json();

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

  const created = await db.transaction(async (tx) => {
    const category = await resolveCategoryId(tx, categoryType);

    if (!category?.id) {
      throw new Error("No se pudo resolver categoria de inventario");
    }

    const itemCode = await nextItemCode(tx, category.type);

    const [created] = await tx
      .insert(inventoryItems)
      .values({
        itemCode,
        name: n,
        unit: u,
        categoryId: category.id,
        description: d ? d : null,
        price: p ? p : undefined,
        supplierId: s ? s : null,
        hasVariants: Boolean(hasVariants),
        isActive: isActive ?? true,
      })
      .returning();

    if (created?.id && ms !== undefined) {
      const principalWarehouseId = await resolveWarehouseIdByLocation(tx, "BODEGA_PRINCIPAL");

      if (principalWarehouseId) {
        const [existingStock] = await tx
          .select({ id: warehouseStock.id })
          .from(warehouseStock)
          .where(
            and(
              eq(warehouseStock.inventoryItemId, created.id),
              eq(warehouseStock.warehouseId, principalWarehouseId),
            ),
          )
          .limit(1);

        if (existingStock?.id) {
          await tx
            .update(warehouseStock)
            .set({ minStock: ms ? ms : "0", lastUpdated: new Date() })
            .where(eq(warehouseStock.id, existingStock.id));
        } else {
          await tx.insert(warehouseStock).values({
            warehouseId: principalWarehouseId,
            inventoryItemId: created.id,
            variantId: null,
            availableQty: "0",
            reservedQty: "0",
            minStock: ms ? ms : "0",
            lastUpdated: new Date(),
          });
        }
      }
    }

    return [created];
  });

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

  const {
    id,
    name,
    unit,
    description,
    price,
    supplierId,
    minStock,
    isActive,
    categoryType,
    hasVariants,
  } = await request.json();

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

  const category = await resolveCategoryId(db, categoryType);

  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .update(inventoryItems)
      .set({
        name: n,
        unit: u,
        categoryId: category?.id,
        description: d !== undefined ? (d ? d : null) : undefined,
        price: p !== undefined ? (p ? p : null) : undefined,
        supplierId: s !== undefined ? (s ? s : null) : undefined,
        hasVariants: hasVariants !== undefined ? Boolean(hasVariants) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, String(id)))
      .returning();

    if (ms !== undefined) {
      const principalWarehouseId = await resolveWarehouseIdByLocation(tx, "BODEGA_PRINCIPAL");

      if (principalWarehouseId) {
        const [existingStock] = await tx
          .select({ id: warehouseStock.id })
          .from(warehouseStock)
          .where(
            and(
              eq(warehouseStock.inventoryItemId, String(id)),
              eq(warehouseStock.warehouseId, principalWarehouseId),
            ),
          )
          .limit(1);

        if (existingStock?.id) {
          await tx
            .update(warehouseStock)
            .set({ minStock: ms ? ms : "0", lastUpdated: new Date() })
            .where(eq(warehouseStock.id, existingStock.id));
        } else {
          await tx.insert(warehouseStock).values({
            warehouseId: principalWarehouseId,
            inventoryItemId: String(id),
            variantId: null,
            availableQty: "0",
            reservedQty: "0",
            minStock: ms ? ms : "0",
            lastUpdated: new Date(),
          });
        }
      }
    }

    return rows;
  });

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