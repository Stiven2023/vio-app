import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryCategories,
  inventoryItemVariants,
  inventoryItems,
  warehouseStock,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import {
  ensureInventoryBaseData,
  resolveWarehouseIdByLocation,
} from "@/src/utils/inventory-sync";
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

async function resolveCategoryId(dbOrTx: any, categoryType?: unknown) {
  await ensureInventoryBaseData(dbOrTx);

  const normalized = String(categoryType ?? "INSUMOS_PRODUCCION")
    .trim()
    .toUpperCase();

  const [categoryRow] = await dbOrTx
    .select({ id: inventoryCategories.id, type: inventoryCategories.type })
    .from(inventoryCategories)
    .where(
      eq(
        inventoryCategories.type,
        normalized as typeof inventoryCategories.$inferSelect.type,
      ),
    )
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
    await ensureInventoryBaseData(db);

    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();

    const where = q ? ilike(inventoryItems.name, `%${q}%`) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(inventoryItems)
      .where(where);

    let items: Array<{
      id: string;
      itemCode: string;
      name: string;
      description: string | null;
      unit: string;
      price: string | null;
      supplierId: string | null;
      categoryId: string | null;
      hasVariants: boolean;
      currentStock: string;
      minStock: string;
      lastMovementType: "ENTRADA" | "SALIDA" | null;
      isActive: boolean | null;
      createdAt: Date | null;
      updatedAt: Date | null;
    }> = [];

    try {
      items = await db
        .select({
          id: inventoryItems.id,
          itemCode: inventoryItems.itemCode,
          name: inventoryItems.name,
          description: inventoryItems.description,
          unit: inventoryItems.unit,
          price: inventoryItems.price,
          supplierId: inventoryItems.supplierId,
          categoryId: inventoryItems.categoryId,
          hasVariants: sql<boolean>`(
            coalesce(${inventoryItems.hasVariants}, false)
            or exists (
              select 1
              from inventory_item_variants iv
              where iv.inventory_item_id = ${inventoryItems.id}
            )
          )`,
          currentStock: sql<string>`(
            case
              when (
                coalesce(${inventoryItems.hasVariants}, false)
                or exists (
                  select 1
                  from inventory_item_variants iv
                  where iv.inventory_item_id = ${inventoryItems.id}
                )
              ) then (
                case
                  when (
                    select count(*)
                    from warehouse_stock ws
                    where ws.variant_id is not null
                      and ws.inventory_item_id = ${inventoryItems.id}
                  ) > 0 then (
                    select coalesce(sum(ws.available_qty), 0)::text
                    from warehouse_stock ws
                    where ws.variant_id is not null
                      and ws.inventory_item_id = ${inventoryItems.id}
                  )
                  else (
                    select coalesce(
                      sum(case when sm.to_warehouse_id is not null then sm.quantity else 0 end)
                      -
                      sum(case when sm.from_warehouse_id is not null then sm.quantity else 0 end),
                      0
                    )::text
                    from stock_movements sm
                    where sm.inventory_item_id = ${inventoryItems.id}
                      and sm.variant_id is not null
                      and sm.movement_type in ('ENTRADA', 'SALIDA', 'TRASLADO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCION')
                  )
                end
              )
              else (
                case
                  when (
                    select count(*)
                    from warehouse_stock ws
                    where ws.inventory_item_id = ${inventoryItems.id}
                      and ws.variant_id is null
                  ) > 0 then (
                    select coalesce(sum(ws.available_qty), 0)::text
                    from warehouse_stock ws
                    where ws.inventory_item_id = ${inventoryItems.id}
                      and ws.variant_id is null
                  )
                  else (
                    select coalesce(
                      sum(case when sm.to_warehouse_id is not null then sm.quantity else 0 end)
                      -
                      sum(case when sm.from_warehouse_id is not null then sm.quantity else 0 end),
                      0
                    )::text
                    from stock_movements sm
                    where sm.inventory_item_id = ${inventoryItems.id}
                      and sm.variant_id is null
                      and sm.movement_type in ('ENTRADA', 'SALIDA', 'TRASLADO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCION')
                  )
                end
              )
            end
          )`,
          minStock: sql<string>`(
            case
                when (
                  coalesce(${inventoryItems.hasVariants}, false)
                  or exists (
                    select 1
                    from inventory_item_variants iv
                    where iv.inventory_item_id = ${inventoryItems.id}
                  )
                ) then (
                select coalesce(sum(ws.min_stock), 0)::text
                from warehouse_stock ws
                where ws.variant_id is not null
                  and ws.inventory_item_id = ${inventoryItems.id}
              )
              else (
                select coalesce(max(ws.min_stock), '0')::text
                from warehouse_stock ws
                join warehouses w on w.id = ws.warehouse_id
                where ws.inventory_item_id = ${inventoryItems.id}
                  and ws.variant_id is null
                  and w.code = 'BODEGA_PRINCIPAL'
              )
            end
          )`,
          lastMovementType: sql<"ENTRADA" | "SALIDA" | null>`(
            select
              case
                when sm.movement_type = 'ENTRADA' then 'ENTRADA'
                when sm.movement_type = 'SALIDA' then 'SALIDA'
                else null
              end
            from stock_movements sm
            where sm.inventory_item_id = ${inventoryItems.id}
              and sm.movement_type in ('ENTRADA', 'SALIDA')
            order by sm.created_at desc
            limit 1
          )`,
          isActive: inventoryItems.isActive,
          createdAt: inventoryItems.createdAt,
          updatedAt: inventoryItems.updatedAt,
        })
        .from(inventoryItems)
        .where(where)
        .orderBy(desc(inventoryItems.name))
        .limit(pageSize)
        .offset(offset);
    } catch {
      // Fallback defensivo: evita tumbar la UI de entradas/inventario
      // cuando una columna nueva o subconsulta no esta disponible en runtime.
      try {
        const basicItems = await db
          .select({
            id: inventoryItems.id,
            itemCode: inventoryItems.itemCode,
            name: inventoryItems.name,
            description: inventoryItems.description,
            unit: inventoryItems.unit,
            price: inventoryItems.price,
            supplierId: inventoryItems.supplierId,
            categoryId: inventoryItems.categoryId,
            hasVariants: sql<boolean>`(
              coalesce(${inventoryItems.hasVariants}, false)
              or exists (
                select 1
                from inventory_item_variants iv
                where iv.inventory_item_id = ${inventoryItems.id}
              )
            )`,
            currentStock: sql<string>`(
              select coalesce(sum(ws.available_qty), 0)::text
              from warehouse_stock ws
              where ws.inventory_item_id = ${inventoryItems.id}
            )`,
            isActive: inventoryItems.isActive,
            createdAt: inventoryItems.createdAt,
            updatedAt: inventoryItems.updatedAt,
          })
          .from(inventoryItems)
          .where(where)
          .orderBy(desc(inventoryItems.name))
          .limit(pageSize)
          .offset(offset);

        items = basicItems.map((row) => ({
          ...row,
          minStock: "0",
          lastMovementType: null,
        }));
      } catch {
        const basicItems = await db
          .select({
            id: inventoryItems.id,
            itemCode: inventoryItems.itemCode,
            name: inventoryItems.name,
            description: inventoryItems.description,
            unit: inventoryItems.unit,
            price: inventoryItems.price,
            supplierId: inventoryItems.supplierId,
            categoryId: inventoryItems.categoryId,
            isActive: inventoryItems.isActive,
            createdAt: inventoryItems.createdAt,
            updatedAt: inventoryItems.updatedAt,
          })
          .from(inventoryItems)
          .where(where)
          .orderBy(desc(inventoryItems.name))
          .limit(pageSize)
          .offset(offset);

        items = basicItems.map((row) => ({
          ...row,
          hasVariants: false,
          currentStock: "0",
          minStock: "0",
          lastMovementType: null,
        }));
      }
    }

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
    initialVariants,
  } = await request.json();

  const n = String(name ?? "").trim();
  const u = String(unit ?? "").trim();
  const d =
    description !== undefined ? String(description ?? "").trim() : undefined;
  const p = price !== undefined ? String(price ?? "").trim() : undefined;
  const s =
    supplierId !== undefined ? String(supplierId ?? "").trim() : undefined;
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

    const normalizedInitialVariants = Array.isArray(initialVariants)
      ? initialVariants
          .map((row) => ({
            sku: sanitizeCode(
              String(row?.sku ?? "")
                .trim()
                .toUpperCase(),
            ),
            color: String(row?.color ?? "").trim(),
            size: String(row?.size ?? "").trim(),
            description: String(row?.description ?? "").trim(),
            isActive:
              row?.isActive !== undefined ? Boolean(row.isActive) : true,
          }))
          .filter((row) => row.sku || row.color || row.size || row.description)
      : [];

    if (
      created?.id &&
      Boolean(hasVariants) &&
      normalizedInitialVariants.length > 0
    ) {
      const seenSku = new Set<string>();

      for (const variant of normalizedInitialVariants) {
        if (!variant.sku) {
          throw new Error("codigo de variante requerido");
        }

        if (seenSku.has(variant.sku)) {
          throw new Error("codigo de variante duplicado");
        }

        seenSku.add(variant.sku);
      }

      const variantsToInsert = normalizedInitialVariants.map((row) => ({
        inventoryItemId: created.id,
        sku: row.sku,
        color: row.color || null,
        size: row.size || null,
        description: row.description || null,
        isActive: row.isActive,
      }));

      await tx.insert(inventoryItemVariants).values(variantsToInsert);
    }

    if (created?.id && ms !== undefined) {
      const principalWarehouseId = await resolveWarehouseIdByLocation(
        tx,
        "BODEGA_PRINCIPAL",
      );

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

  const d =
    description !== undefined ? String(description ?? "").trim() : undefined;
  const p = price !== undefined ? String(price ?? "").trim() : undefined;
  const s =
    supplierId !== undefined ? String(supplierId ?? "").trim() : undefined;
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
        hasVariants:
          hasVariants !== undefined ? Boolean(hasVariants) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, String(id)))
      .returning();

    if (ms !== undefined) {
      const principalWarehouseId = await resolveWarehouseIdByLocation(
        tx,
        "BODEGA_PRINCIPAL",
      );

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
