import { desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { inventoryEntries, inventoryItems, suppliers } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { createNotificationsForPermission } from "@/src/utils/notifications";

function toPositiveNumber(v: unknown) {
  const n = Number(String(v));

  return Number.isFinite(n) && n > 0 ? n : null;
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

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const q = String(searchParams.get("q") ?? "").trim();

  const where = q ? ilike(inventoryItems.name, `%${q}%`) : undefined;

  const totalQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(inventoryEntries)
    .leftJoin(inventoryItems, eq(inventoryEntries.inventoryItemId, inventoryItems.id));

  const [{ total }] = where ? await totalQuery.where(where) : await totalQuery;

  const itemsQuery = db
    .select({
      id: inventoryEntries.id,
      inventoryItemId: inventoryEntries.inventoryItemId,
      itemName: inventoryItems.name,
      supplierId: inventoryEntries.supplierId,
      supplierName: suppliers.name,
      quantity: inventoryEntries.quantity,
      createdAt: inventoryEntries.createdAt,
    })
    .from(inventoryEntries)
    .leftJoin(inventoryItems, eq(inventoryEntries.inventoryItemId, inventoryItems.id))
    .leftJoin(suppliers, eq(inventoryEntries.supplierId, suppliers.id))
    .orderBy(desc(inventoryEntries.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = where ? await itemsQuery.where(where) : await itemsQuery;
  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
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

  const { inventoryItemId, supplierId, quantity } = await request.json();

  const itemId = String(inventoryItemId ?? "").trim();
  const supId = String(supplierId ?? "").trim();
  const qty = toPositiveNumber(quantity);

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!qty) return new Response("quantity must be positive", { status: 400 });

  const created = await db
    .insert(inventoryEntries)
    .values({
      inventoryItemId: itemId,
      supplierId: supId ? supId : null,
      quantity: String(qty),
    })
    .returning();

  const [itemRow] = await db
    .select({ name: inventoryItems.name })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, itemId))
    .limit(1);

  await createNotificationsForPermission("VER_INVENTARIO", {
    title: "Entrada de inventario",
    message: `Entrada registrada: ${itemRow?.name ?? "Item"} +${qty}.`,
    href: "/catalog",
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

  const { id, inventoryItemId, supplierId, quantity } = await request.json();

  if (!id) return new Response("Inventory entry ID required", { status: 400 });

  const itemId = String(inventoryItemId ?? "").trim();
  const supId = String(supplierId ?? "").trim();
  const qty = toPositiveNumber(quantity);

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!qty) return new Response("quantity must be positive", { status: 400 });

  const updated = await db
    .update(inventoryEntries)
    .set({
      inventoryItemId: itemId,
      supplierId: supId ? supId : null,
      quantity: String(qty),
    })
    .where(eq(inventoryEntries.id, String(id)))
    .returning();

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

  const deleted = await db
    .delete(inventoryEntries)
    .where(eq(inventoryEntries.id, String(id)))
    .returning();

  return Response.json(deleted);
}
