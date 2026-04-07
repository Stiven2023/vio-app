import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryItemVariants,
  inventoryItems,
  stockMovements,
  suppliers,
  warehouses,
} from "@/src/db/erp/schema";
import { dbJsonError, jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  inventoryEntryCreateSchema,
  inventoryEntryDeleteSchema,
  inventoryEntryUpdateSchema,
  inventoryLocationSchema,
} from "@/src/utils/inventory-entries-contract";
import {
  resolveWarehouseIdByLocation,
  syncInventoryForItem,
  syncInventoryForVariant,
} from "@/src/utils/inventory-sync";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { createNotificationsForPermission } from "@/src/utils/notifications";

async function resolveTargetWarehouseId(payload: {
  warehouseId?: unknown;
  location?: unknown;
}) {
  const wId = String(payload.warehouseId ?? "").trim();

  if (wId) return wId;

  const locParsed = inventoryLocationSchema.safeParse(
    String(payload.location ?? "BODEGA_PRINCIPAL").trim().toUpperCase(),
  );
  const loc = locParsed.success ? locParsed.data : null;

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
    const response = dbJsonError(error, "No se pudo consultar entradas.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo consultar entradas.");
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

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para registrar entradas.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = inventoryEntryCreateSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos de entrada de inventario son inválidos.");
  }

  const itemId = parsed.data.inventoryItemId;
  const vId = parsed.data.variantId;
  const targetWarehouseId = await resolveTargetWarehouseId({
    warehouseId: parsed.data.warehouseId,
    location: parsed.data.location,
  });
  const qty = parsed.data.quantity;
  const entryReason = parsed.data.reason;
  const supplierId = parsed.data.supplierId;

  if (!targetWarehouseId) {
    return jsonError(400, "VALIDATION_ERROR", "warehouse invalid", {
      warehouseId: ["Debes indicar una bodega o ubicación válida."],
    });
  }

  try {
    const [warehouseRow] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.id, targetWarehouseId))
      .limit(1);

    if (!warehouseRow) {
      return jsonError(404, "WAREHOUSE_NOT_FOUND", "warehouse not found");
    }

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

    if (!variantRow) {
      return jsonError(404, "VARIANT_NOT_FOUND", "variant not found");
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
      return jsonError(404, "INVENTORY_ITEM_NOT_FOUND", "inventory item not found");
    }

    const created = await db.transaction(async (tx) => {
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
  } catch (error) {
    const response = dbJsonError(error, "No se pudo registrar la entrada.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo registrar la entrada.");
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-entries:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_ENTRADA");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para editar entradas.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = inventoryEntryUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos para editar entrada son inválidos.");
  }

  const id = parsed.data.id;
  const itemId = parsed.data.inventoryItemId;
  const vId = parsed.data.variantId;
  const targetWarehouseId = await resolveTargetWarehouseId({
    warehouseId: parsed.data.warehouseId,
    location: parsed.data.location,
  });
  const qty = parsed.data.quantity;

  if (!targetWarehouseId) {
    return jsonError(400, "VALIDATION_ERROR", "warehouse invalid", {
      warehouseId: ["Debes indicar una bodega o ubicación válida."],
    });
  }

  try {
    const [warehouseRow] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.id, targetWarehouseId))
      .limit(1);

    if (!warehouseRow) {
      return jsonError(404, "WAREHOUSE_NOT_FOUND", "warehouse not found");
    }

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

    if (!variantRow) {
      return jsonError(404, "VARIANT_NOT_FOUND", "variant not found");
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
        if (existing.variantId) await syncInventoryForVariant(tx, existing.variantId);
        if (vId && existing.variantId !== vId) await syncInventoryForVariant(tx, vId);
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
      return jsonError(404, "INVENTORY_ITEM_NOT_FOUND", "inventory item not found");
    }

    if (updated.length === 0) {
      return jsonError(404, "ENTRY_NOT_FOUND", "Not found");
    }

    return Response.json(updated);
  } catch (error) {
    const response = dbJsonError(error, "No se pudo editar la entrada.");
    if (response) return response;
    return jsonError(500, "INTERNAL_ERROR", "No se pudo editar la entrada.");
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-entries:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_ENTRADA");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para eliminar entradas.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = inventoryEntryDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos para eliminar entrada son inválidos.");
  }

  const id = parsed.data.id;

  try {
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

    if (deleted.length === 0) {
      return jsonError(404, "ENTRY_NOT_FOUND", "Not found");
    }

    return Response.json(deleted);
  } catch (error) {
    const response = dbJsonError(error, "No se pudo eliminar la entrada.");
    if (response) return response;
    return jsonError(500, "INTERNAL_ERROR", "No se pudo eliminar la entrada.");
  }
}
