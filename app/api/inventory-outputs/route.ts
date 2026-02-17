import { desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryItems,
  inventoryOutputs,
  orderItems,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { computeStockForItem, syncInventoryForItem } from "@/src/utils/inventory-sync";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { createNotificationsForPermission } from "@/src/utils/notifications";

function toPositiveNumber(v: unknown) {
  const n = Number(String(v));

  return Number.isFinite(n) && n > 0 ? n : null;
}

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

function toLocation(v: unknown): "BODEGA_PRINCIPAL" | "TIENDA" | null {
  const location = String(v ?? "BODEGA_PRINCIPAL").trim().toUpperCase();

  return location === "BODEGA_PRINCIPAL" || location === "TIENDA"
    ? (location as "BODEGA_PRINCIPAL" | "TIENDA")
    : null;
}


export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-outputs:get",
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

    const where = q ? ilike(inventoryItems.name, `%${q}%`) : undefined;

    const totalQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(inventoryOutputs)
      .leftJoin(
        inventoryItems,
        eq(inventoryOutputs.inventoryItemId, inventoryItems.id),
      );

    const [{ total }] = where ? await totalQuery.where(where) : await totalQuery;

    const itemsQuery = db
      .select({
        id: inventoryOutputs.id,
        inventoryItemId: inventoryOutputs.inventoryItemId,
        itemName: inventoryItems.name,
        orderItemId: inventoryOutputs.orderItemId,
        orderItemName: orderItems.name,
        location: inventoryOutputs.location,
        quantity: inventoryOutputs.quantity,
        reason: inventoryOutputs.reason,
        createdAt: inventoryOutputs.createdAt,
      })
      .from(inventoryOutputs)
      .leftJoin(
        inventoryItems,
        eq(inventoryOutputs.inventoryItemId, inventoryItems.id),
      )
      .leftJoin(orderItems, eq(inventoryOutputs.orderItemId, orderItems.id))
      .orderBy(desc(inventoryOutputs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = where ? await itemsQuery.where(where) : await itemsQuery;
    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar salidas", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-outputs:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");

  if (forbidden) return forbidden;

  const { inventoryItemId, orderItemId, location, quantity, reason } = await request.json();

  const itemId = String(inventoryItemId ?? "").trim();
  const ordId = String(orderItemId ?? "").trim();
  const loc = toLocation(location);
  const qty = toPositiveNumber(quantity);
  const r = String(reason ?? "").trim();

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!loc) return new Response("location invalid", { status: 400 });
  if (!qty) return new Response("quantity must be positive", { status: 400 });
  if (!r) return new Response("reason required", { status: 400 });

  const stock = await computeStockForItem(db, itemId, loc);

  if (qty > stock) {
    return new Response("Stock insuficiente", { status: 400 });
  }

  const created = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(inventoryOutputs)
      .values({
        inventoryItemId: itemId,
        orderItemId: ordId ? ordId : null,
        location: loc,
        quantity: String(qty),
        reason: r,
      })
      .returning();

    await syncInventoryForItem(tx, itemId);
    return rows;
  });

  const [itemRow] = await db
    .select({ name: inventoryItems.name })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, itemId))
    .limit(1);

  await createNotificationsForPermission("VER_INVENTARIO", {
    title: "Salida de inventario",
    message: `Salida registrada: ${itemRow?.name ?? "Item"} -${qty}.`,
    href: "/catalog",
  });

  return Response.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-outputs:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");

  if (forbidden) return forbidden;

  const { id, inventoryItemId, orderItemId, location, quantity, reason } =
    await request.json();

  if (!id) return new Response("Inventory output ID required", { status: 400 });

  const itemId = String(inventoryItemId ?? "").trim();
  const ordId = String(orderItemId ?? "").trim();
  const loc = toLocation(location);
  const qty = toPositiveNumber(quantity);
  const r = String(reason ?? "").trim();

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!loc) return new Response("location invalid", { status: 400 });
  if (!qty) return new Response("quantity must be positive", { status: 400 });
  if (!r) return new Response("reason required", { status: 400 });

  const [existing] = await db
    .select({
      quantity: inventoryOutputs.quantity,
      inventoryItemId: inventoryOutputs.inventoryItemId,
      location: inventoryOutputs.location,
    })
    .from(inventoryOutputs)
    .where(eq(inventoryOutputs.id, String(id)))
    .limit(1);

  if (!existing) return new Response("Not found", { status: 404 });

  const stock = await computeStockForItem(db, itemId, loc);
  const currentQty = asNumber(existing.quantity);
  const available =
    stock +
    (existing.inventoryItemId === itemId && existing.location === loc
      ? currentQty
      : 0);

  if (qty > available) {
    return new Response("Stock insuficiente", { status: 400 });
  }

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        inventoryItemId: inventoryOutputs.inventoryItemId,
        quantity: inventoryOutputs.quantity,
        location: inventoryOutputs.location,
      })
      .from(inventoryOutputs)
      .where(eq(inventoryOutputs.id, String(id)))
      .limit(1);

    if (!existing) return [];

    // Revalidar stock con el estado más reciente dentro de la tx
    const stock = await computeStockForItem(tx, itemId, loc);
    const currentQty = asNumber(existing.quantity);
    const available =
      stock +
      (existing.inventoryItemId === itemId && existing.location === loc
        ? currentQty
        : 0);

    if (qty > available) {
      throw new Error("Stock insuficiente");
    }

    const rows = await tx
      .update(inventoryOutputs)
      .set({
        inventoryItemId: itemId,
        orderItemId: ordId ? ordId : null,
        location: loc,
        quantity: String(qty),
        reason: r,
      })
      .where(eq(inventoryOutputs.id, String(id)))
      .returning();

    await syncInventoryForItem(tx, existing.inventoryItemId ?? itemId);
    if (existing.inventoryItemId && existing.inventoryItemId !== itemId) {
      await syncInventoryForItem(tx, itemId);
    }

    return rows;
  }).catch((e) => {
    if (String((e as any)?.message ?? "") === "Stock insuficiente") {
      return "__stock" as any;
    }
    throw e;
  });

  if (updated === "__stock") {
    return new Response("Stock insuficiente", { status: 400 });
  }

  if (Array.isArray(updated) && updated.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-outputs:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) return new Response("Inventory output ID required", { status: 400 });

  const deleted = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ inventoryItemId: inventoryOutputs.inventoryItemId })
      .from(inventoryOutputs)
      .where(eq(inventoryOutputs.id, String(id)))
      .limit(1);

    if (!existing) return [];

    const rows = await tx
      .delete(inventoryOutputs)
      .where(eq(inventoryOutputs.id, String(id)))
      .returning();

    if (existing.inventoryItemId) {
      await syncInventoryForItem(tx, existing.inventoryItemId);
    }
    return rows;
  });

  if (deleted.length === 0) return new Response("Not found", { status: 404 });

  return Response.json(deleted);
}
