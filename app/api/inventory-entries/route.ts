import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryItemVariants,
  inventoryItems,
  stockMovements,
  suppliers,
  warehouses,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import {
  resolveWarehouseIdByLocation,
  syncInventoryForItem,
  syncInventoryForVariant,
} from "@/src/utils/inventory-sync";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { createNotificationsForPermission } from "@/src/utils/notifications";

function toPositiveNumber(v: unknown) {
  const n = Number(String(v));

  return Number.isFinite(n) && n > 0 ? n : null;
}

function toLocation(v: unknown): "BODEGA_PRINCIPAL" | "TIENDA" | null {
  const location = String(v ?? "BODEGA_PRINCIPAL")
    .trim()
    .toUpperCase();

  return location === "BODEGA_PRINCIPAL" || location === "TIENDA"
    ? (location as "BODEGA_PRINCIPAL" | "TIENDA")
    : null;
}

async function resolveTargetWarehouseId(payload: {
  warehouseId?: unknown;
  location?: unknown;
}) {
  const wId = String(payload.warehouseId ?? "").trim();

  if (wId) return wId;

  const loc = toLocation(payload.location);

  if (!loc) return null;

  return resolveWarehouseIdByLocation(db, loc);
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-entries:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();

    const where = and(
      eq(stockMovements.movementType, "ENTRADA"),
      q ? ilike(inventoryItems.name, `%${q}%`) : undefined,
    );

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(stockMovements)
      .leftJoin(
        inventoryItems,
        eq(stockMovements.inventoryItemId, inventoryItems.id),
      )
      .where(where);

    const items = await db
      .select({
        id: stockMovements.id,
        inventoryItemId: stockMovements.inventoryItemId,
        variantId: stockMovements.variantId,
        itemName: inventoryItems.name,
        variantSku: inventoryItemVariants.sku,
        variantColor: inventoryItemVariants.color,
        variantSize: inventoryItemVariants.size,
        supplierId: inventoryItems.supplierId,
        supplierName: suppliers.name,
        warehouseId: warehouses.id,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        location: sql<"BODEGA_PRINCIPAL" | "TIENDA" | null>`(
          case
            when ${warehouses.code} = 'TIENDA' then 'TIENDA'
            when ${warehouses.code} = 'BODEGA_PRINCIPAL' then 'BODEGA_PRINCIPAL'
            else null
          end
        )`,
        quantity: stockMovements.quantity,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .leftJoin(
        inventoryItems,
        eq(stockMovements.inventoryItemId, inventoryItems.id),
      )
      .leftJoin(suppliers, eq(inventoryItems.supplierId, suppliers.id))
      .leftJoin(
        inventoryItemVariants,
        eq(stockMovements.variantId, inventoryItemVariants.id),
      )
      .leftJoin(warehouses, eq(stockMovements.toWarehouseId, warehouses.id))
      .where(where)
      .orderBy(desc(stockMovements.createdAt))
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar entradas", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-entries:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_ENTRADA");

  if (forbidden) return forbidden;

  const {
    inventoryItemId,
    variantId,
    warehouseId,
    location,
    quantity,
    reason,
    supplierId,
  } = await request.json();

  const itemId = String(inventoryItemId ?? "").trim();
  const vId = String(variantId ?? "").trim();
  const targetWarehouseId = await resolveTargetWarehouseId({
    warehouseId,
    location,
  });
  const qty = toPositiveNumber(quantity);

  const ALLOWED_ENTRY_REASONS = [
    "COMPRA_PROVEEDOR",
    "DEVOLUCION_CLIENTE",
    "AJUSTE_INVENTARIO",
    "DEVOLUCION_PROVEEDOR",
    "OTRO",
  ] as const;

  type AllowedEntryReason = (typeof ALLOWED_ENTRY_REASONS)[number];
  const rawReason = String(reason ?? "COMPRA_PROVEEDOR")
    .trim()
    .toUpperCase();
  const entryReason: AllowedEntryReason = (
    ALLOWED_ENTRY_REASONS as readonly string[]
  ).includes(rawReason)
    ? (rawReason as AllowedEntryReason)
    : "COMPRA_PROVEEDOR";

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!vId) return new Response("variantId required", { status: 400 });
  if (!targetWarehouseId)
    return new Response("warehouse invalid", { status: 400 });
  if (!qty) return new Response("quantity must be positive", { status: 400 });

  const [warehouseRow] = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(eq(warehouses.id, targetWarehouseId))
    .limit(1);

  if (!warehouseRow)
    return new Response("warehouse not found", { status: 404 });

  if (vId) {
    const [variantRow] = await db
      .select({ id: inventoryItemVariants.id })
      .from(inventoryItemVariants)
      .where(
        and(
          eq(inventoryItemVariants.id, vId),
          eq(inventoryItemVariants.inventoryItemId, itemId),
        ),
      )
      .limit(1);

    if (!variantRow) return new Response("variant not found", { status: 404 });
  }

  const [itemRow] = await db
    .select({
      name: inventoryItems.name,
      price: inventoryItems.price,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, itemId))
    .limit(1);

  if (!itemRow) {
    return new Response("inventory item not found", { status: 404 });
  }

  const created = await db.transaction(async (tx) => {
    // Update variant supplierId if provided
    if (vId && supplierId) {
      await tx
        .update(inventoryItemVariants)
        .set({ supplierId: String(supplierId).trim() || null })
        .where(eq(inventoryItemVariants.id, vId));
    }

    const rows = await tx
      .insert(stockMovements)
      .values({
        movementType: "ENTRADA",
        reason: entryReason,
        inventoryItemId: itemId,
        variantId: vId || null,
        fromWarehouseId: null,
        toWarehouseId: targetWarehouseId,
        quantity: String(qty),
        unitCost: itemRow.price ?? null,
        referenceType: "MANUAL",
        referenceId: null,
      })
      .returning();

    await syncInventoryForItem(tx, itemId);
    if (vId) await syncInventoryForVariant(tx, vId);

    return rows;
  });

  await createNotificationsForPermission("VER_INVENTARIO", {
    title: "Entrada de inventario",
    message: `Entrada registrada: ${itemRow.name ?? "Item"} +${qty}.`,
    href: "/erp/inventory",
  });

  return Response.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-entries:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_ENTRADA");

  if (forbidden) return forbidden;

  const { id, inventoryItemId, variantId, warehouseId, location, quantity } =
    await request.json();

  if (!id) return new Response("Inventory entry ID required", { status: 400 });

  const itemId = String(inventoryItemId ?? "").trim();
  const vId = String(variantId ?? "").trim();
  const targetWarehouseId = await resolveTargetWarehouseId({
    warehouseId,
    location,
  });
  const qty = toPositiveNumber(quantity);

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!vId) return new Response("variantId required", { status: 400 });
  if (!targetWarehouseId)
    return new Response("warehouse invalid", { status: 400 });
  if (!qty) return new Response("quantity must be positive", { status: 400 });

  const [warehouseRow] = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(eq(warehouses.id, targetWarehouseId))
    .limit(1);

  if (!warehouseRow)
    return new Response("warehouse not found", { status: 404 });

  if (vId) {
    const [variantRow] = await db
      .select({ id: inventoryItemVariants.id })
      .from(inventoryItemVariants)
      .where(
        and(
          eq(inventoryItemVariants.id, vId),
          eq(inventoryItemVariants.inventoryItemId, itemId),
        ),
      )
      .limit(1);

    if (!variantRow) return new Response("variant not found", { status: 404 });
  }

  const updated = await db
    .transaction(async (tx) => {
      const [itemRow] = await tx
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(eq(inventoryItems.id, itemId))
        .limit(1);

      if (!itemRow) {
        throw new Error("inventory item not found");
      }

      const [existing] = await tx
        .select({
          inventoryItemId: stockMovements.inventoryItemId,
          variantId: stockMovements.variantId,
          movementType: stockMovements.movementType,
        })
        .from(stockMovements)
        .where(eq(stockMovements.id, String(id)))
        .limit(1);

      if (!existing || existing.movementType !== "ENTRADA") return [];

      const rows = await tx
        .update(stockMovements)
        .set({
          inventoryItemId: itemId,
          variantId: vId || null,
          fromWarehouseId: null,
          toWarehouseId: targetWarehouseId,
          quantity: String(qty),
          reason: "COMPRA_PROVEEDOR",
        })
        .where(eq(stockMovements.id, String(id)))
        .returning();

      await syncInventoryForItem(tx, existing.inventoryItemId ?? itemId);
      if (existing.variantId)
        await syncInventoryForVariant(tx, existing.variantId);
      if (vId && existing.variantId !== vId)
        await syncInventoryForVariant(tx, vId);
      if (existing.inventoryItemId && existing.inventoryItemId !== itemId) {
        await syncInventoryForItem(tx, itemId);
      }

      return rows;
    })
    .catch((e) => {
      const msg = String((e as { message?: string })?.message ?? "");

      if (msg === "inventory item not found") return "__item" as const;
      throw e;
    });

  if (updated === "__item") {
    return new Response("inventory item not found", { status: 404 });
  }

  if (updated.length === 0) return new Response("Not found", { status: 404 });

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-entries:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_ENTRADA");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) return new Response("Inventory entry ID required", { status: 400 });

  const deleted = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        inventoryItemId: stockMovements.inventoryItemId,
        variantId: stockMovements.variantId,
        movementType: stockMovements.movementType,
      })
      .from(stockMovements)
      .where(eq(stockMovements.id, String(id)))
      .limit(1);

    if (!existing || existing.movementType !== "ENTRADA") return [];

    const rows = await tx
      .delete(stockMovements)
      .where(eq(stockMovements.id, String(id)))
      .returning();

    if (existing.inventoryItemId) {
      await syncInventoryForItem(tx, existing.inventoryItemId);
    }
    if (existing.variantId) {
      await syncInventoryForVariant(tx, existing.variantId);
    }

    return rows;
  });

  if (deleted.length === 0) return new Response("Not found", { status: 404 });

  return Response.json(deleted);
}
