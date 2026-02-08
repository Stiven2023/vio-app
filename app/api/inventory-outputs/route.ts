import { desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryEntries,
  inventoryItems,
  inventoryOutputs,
  orderItems,
} from "@/src/db/schema";
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

async function getStockForItem(itemId: string) {
  const [entriesRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${inventoryEntries.quantity}), 0)::text`,
    })
    .from(inventoryEntries)
    .where(eq(inventoryEntries.inventoryItemId, itemId));

  const [outputsRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${inventoryOutputs.quantity}), 0)::text`,
    })
    .from(inventoryOutputs)
    .where(eq(inventoryOutputs.inventoryItemId, itemId));

  const entries = asNumber(entriesRow?.total);
  const outputs = asNumber(outputsRow?.total);

  return entries - outputs;
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

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const q = String(searchParams.get("q") ?? "").trim();

  const where = q ? ilike(inventoryItems.name, `%${q}%`) : undefined;

  const totalQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(inventoryOutputs)
    .leftJoin(inventoryItems, eq(inventoryOutputs.inventoryItemId, inventoryItems.id));

  const [{ total }] = where ? await totalQuery.where(where) : await totalQuery;

  const itemsQuery = db
    .select({
      id: inventoryOutputs.id,
      inventoryItemId: inventoryOutputs.inventoryItemId,
      itemName: inventoryItems.name,
      orderItemId: inventoryOutputs.orderItemId,
      orderItemName: orderItems.name,
      quantity: inventoryOutputs.quantity,
      reason: inventoryOutputs.reason,
      createdAt: inventoryOutputs.createdAt,
    })
    .from(inventoryOutputs)
    .leftJoin(inventoryItems, eq(inventoryOutputs.inventoryItemId, inventoryItems.id))
    .leftJoin(orderItems, eq(inventoryOutputs.orderItemId, orderItems.id))
    .orderBy(desc(inventoryOutputs.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = where ? await itemsQuery.where(where) : await itemsQuery;
  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
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

  const { inventoryItemId, orderItemId, quantity, reason } = await request.json();

  const itemId = String(inventoryItemId ?? "").trim();
  const ordId = String(orderItemId ?? "").trim();
  const qty = toPositiveNumber(quantity);
  const r = String(reason ?? "").trim();

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!qty) return new Response("quantity must be positive", { status: 400 });
  if (!r) return new Response("reason required", { status: 400 });

  const stock = await getStockForItem(itemId);

  if (qty > stock) {
    return new Response("Stock insuficiente", { status: 400 });
  }

  const created = await db
    .insert(inventoryOutputs)
    .values({
      inventoryItemId: itemId,
      orderItemId: ordId ? ordId : null,
      quantity: String(qty),
      reason: r,
    })
    .returning();

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

  const { id, inventoryItemId, orderItemId, quantity, reason } =
    await request.json();

  if (!id) return new Response("Inventory output ID required", { status: 400 });

  const itemId = String(inventoryItemId ?? "").trim();
  const ordId = String(orderItemId ?? "").trim();
  const qty = toPositiveNumber(quantity);
  const r = String(reason ?? "").trim();

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!qty) return new Response("quantity must be positive", { status: 400 });
  if (!r) return new Response("reason required", { status: 400 });

  const [existing] = await db
    .select({
      quantity: inventoryOutputs.quantity,
      inventoryItemId: inventoryOutputs.inventoryItemId,
    })
    .from(inventoryOutputs)
    .where(eq(inventoryOutputs.id, String(id)))
    .limit(1);

  if (!existing) return new Response("Not found", { status: 404 });

  const stock = await getStockForItem(itemId);
  const currentQty = asNumber(existing.quantity);
  const available = stock + currentQty;

  if (qty > available) {
    return new Response("Stock insuficiente", { status: 400 });
  }

  const updated = await db
    .update(inventoryOutputs)
    .set({
      inventoryItemId: itemId,
      orderItemId: ordId ? ordId : null,
      quantity: String(qty),
      reason: r,
    })
    .where(eq(inventoryOutputs.id, String(id)))
    .returning();

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

  const deleted = await db
    .delete(inventoryOutputs)
    .where(eq(inventoryOutputs.id, String(id)))
    .returning();

  return Response.json(deleted);
}
