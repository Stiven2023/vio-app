import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  employees,
  inventoryItemVariants,
  inventoryItems,
  orderItems,
  orders,
  stockMovements,
  warehouses,
} from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import {
  inventoryOutputDeleteSchema,
  inventoryOutputLocationSchema,
  inventoryOutputMutationSchema,
  inventoryOutputUpdateSchema,
} from "@/src/utils/inventory-outputs-contract";
import {
  computeStockForVariantInWarehouse,
  resolveWarehouseIdByLocation,
  syncInventoryForItem,
  syncInventoryForVariant,
} from "@/src/utils/inventory-sync";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { createNotificationsForPermission } from "@/src/utils/notifications";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

async function resolveSourceWarehouseId(payload: {
  warehouseId?: unknown;
  location?: unknown;
}) {
  const wId = String(payload.warehouseId ?? "").trim();

  if (wId) return wId;

  const locParsed = inventoryOutputLocationSchema.safeParse(
    String(payload.location ?? "BODEGA_PRINCIPAL")
      .trim()
      .toUpperCase(),
  );
  const loc = locParsed.success ? locParsed.data : null;

  if (!loc) return null;

  return resolveWarehouseIdByLocation(db, loc);
}

function mapReasonToEnum(reason: string) {
  const r = reason.trim().toUpperCase();

  if (r.includes("PRODUC")) return "PRODUCCION" as const;
  if (r.includes("VENTA")) return "VENTA" as const;
  if (r.includes("CONFECCION")) return "DESPACHO_CONFECCIONISTA" as const;
  if (r.includes("AJUSTE")) return "AJUSTE_INVENTARIO" as const;
  if (r.includes("DEVOLUCION PROVEEDOR"))
    return "DEVOLUCION_PROVEEDOR" as const;
  if (r.includes("DEVOLUCION CLIENTE")) return "DEVOLUCION_CLIENTE" as const;
  if (r.includes("TRASLADO")) return "TRASLADO_INTERNO" as const;
  if (r.includes("MUESTRA")) return "MUESTRA" as const;
  if (r.includes("BAJA")) return "BAJA" as const;

  return "OTRO" as const;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-outputs:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) {
    return jsonError(
      403,
      "FORBIDDEN",
      "No tienes permisos para consultar salidas.",
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();

    const where = and(
      eq(stockMovements.movementType, "SALIDA"),
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
        orderItemId: stockMovements.referenceId,
        orderCode: orders.orderCode,
        requesterEmployeeName: employees.name,
        orderItemName: orderItems.name,
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
        reason: stockMovements.notes,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .leftJoin(
        inventoryItems,
        eq(stockMovements.inventoryItemId, inventoryItems.id),
      )
      .leftJoin(orderItems, eq(stockMovements.referenceId, orderItems.id))
      .leftJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(employees, eq(orders.createdBy, employees.id))
      .leftJoin(
        inventoryItemVariants,
        eq(stockMovements.variantId, inventoryItemVariants.id),
      )
      .leftJoin(warehouses, eq(stockMovements.fromWarehouseId, warehouses.id))
      .where(where)
      .orderBy(desc(stockMovements.createdAt))
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbJsonError(error, "No se pudo consultar salidas.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo consultar salidas.");
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

  if (forbidden) {
    return jsonError(
      403,
      "FORBIDDEN",
      "No tienes permisos para registrar salidas.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "El cuerpo de la solicitud no es JSON válido.",
      {
        body: ["Envía un JSON válido."],
      },
    );
  }

  const parsed = inventoryOutputMutationSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Los datos de salida de inventario son inválidos.",
    );
  }

  const itemId = parsed.data.inventoryItemId;
  const vId = parsed.data.variantId;
  const ordId = String(parsed.data.orderItemId ?? "").trim();
  const sourceWarehouseId = await resolveSourceWarehouseId({
    warehouseId: parsed.data.warehouseId,
    location: parsed.data.location,
  });
  const qty = parsed.data.quantity;
  const reasonText = parsed.data.reason;

  if (!ordId && mapReasonToEnum(reasonText) === "VENTA") {
    return jsonError(
      422,
      "ORDER_ITEM_REQUIRED",
      "orderItemId requerido para salidas por venta",
      {
        orderItemId: ["Debes indicar el diseño para una salida por venta."],
      },
    );
  }

  if (!sourceWarehouseId) {
    return jsonError(400, "VALIDATION_ERROR", "warehouse invalid", {
      warehouseId: ["Debes indicar una bodega o ubicación válida."],
    });
  }

  try {
    const [itemRow] = await db
      .select({ name: inventoryItems.name })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, itemId))
      .limit(1);

    if (!itemRow) {
      return jsonError(
        404,
        "INVENTORY_ITEM_NOT_FOUND",
        "inventory item not found",
      );
    }

    const [warehouseRow] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.id, sourceWarehouseId))
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

    const stock = await computeStockForVariantInWarehouse(
      db,
      vId,
      sourceWarehouseId,
    );

    if (qty > stock) {
      return jsonError(422, "INSUFFICIENT_STOCK", "Stock insuficiente", {
        quantity: ["La cantidad excede el disponible."],
      });
    }

    const created = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(stockMovements)
        .values({
          movementType: "SALIDA",
          reason: mapReasonToEnum(reasonText),
          notes: reasonText,
          inventoryItemId: itemId,
          variantId: vId || null,
          fromWarehouseId: sourceWarehouseId,
          toWarehouseId: null,
          quantity: String(qty),
          referenceType: ordId ? "ORDER_ITEM" : "MANUAL",
          referenceId: ordId || null,
        })
        .returning();

      await syncInventoryForItem(tx, itemId);
      if (vId) await syncInventoryForVariant(tx, vId);

      return rows;
    });

    await createNotificationsForPermission("VER_INVENTARIO", {
      title: "Salida de inventario",
      message: `Salida registrada: ${itemRow.name ?? "Item"} -${qty}.`,
      href: "/erp/inventory",
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbJsonError(error, "No se pudo registrar la salida.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo registrar la salida.");
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-outputs:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");

  if (forbidden) {
    return jsonError(
      403,
      "FORBIDDEN",
      "No tienes permisos para editar salidas.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "El cuerpo de la solicitud no es JSON válido.",
      {
        body: ["Envía un JSON válido."],
      },
    );
  }

  const parsed = inventoryOutputUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Los datos para editar salida son inválidos.",
    );
  }

  const id = parsed.data.id;
  const itemId = parsed.data.inventoryItemId;
  const vId = parsed.data.variantId;
  const ordId = String(parsed.data.orderItemId ?? "").trim();
  const sourceWarehouseId = await resolveSourceWarehouseId({
    warehouseId: parsed.data.warehouseId,
    location: parsed.data.location,
  });
  const qty = parsed.data.quantity;
  const reasonText = parsed.data.reason;

  if (!ordId && mapReasonToEnum(reasonText) === "VENTA") {
    return jsonError(
      422,
      "ORDER_ITEM_REQUIRED",
      "orderItemId requerido para salidas por venta",
      {
        orderItemId: ["Debes indicar el diseño para una salida por venta."],
      },
    );
  }

  if (!sourceWarehouseId) {
    return jsonError(400, "VALIDATION_ERROR", "warehouse invalid", {
      warehouseId: ["Debes indicar una bodega o ubicación válida."],
    });
  }

  try {
    const [itemRow] = await db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, itemId))
      .limit(1);

    if (!itemRow)
      return jsonError(
        404,
        "INVENTORY_ITEM_NOT_FOUND",
        "inventory item not found",
      );

    const [warehouseRow] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.id, sourceWarehouseId))
      .limit(1);

    if (!warehouseRow)
      return jsonError(404, "WAREHOUSE_NOT_FOUND", "warehouse not found");

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

    if (!variantRow)
      return jsonError(404, "VARIANT_NOT_FOUND", "variant not found");

    const [existing] = await db
      .select({
        quantity: stockMovements.quantity,
        inventoryItemId: stockMovements.inventoryItemId,
        variantId: stockMovements.variantId,
        fromWarehouseId: stockMovements.fromWarehouseId,
        movementType: stockMovements.movementType,
      })
      .from(stockMovements)
      .where(eq(stockMovements.id, String(id)))
      .limit(1);

    if (!existing || existing.movementType !== "SALIDA") {
      return jsonError(404, "ENTRY_NOT_FOUND", "Not found");
    }

    const stock = await computeStockForVariantInWarehouse(
      db,
      vId,
      sourceWarehouseId,
    );
    const currentQty = asNumber(existing.quantity);
    const available =
      stock +
      (existing.inventoryItemId === itemId &&
      existing.fromWarehouseId === sourceWarehouseId &&
      (existing.variantId ?? "") === vId
        ? currentQty
        : 0);

    if (qty > available) {
      return jsonError(422, "INSUFFICIENT_STOCK", "Stock insuficiente", {
        quantity: ["La cantidad excede el disponible."],
      });
    }

    const updated = await db
      .transaction(async (tx) => {
        const [existingTx] = await tx
          .select({
            inventoryItemId: stockMovements.inventoryItemId,
            variantId: stockMovements.variantId,
            quantity: stockMovements.quantity,
            fromWarehouseId: stockMovements.fromWarehouseId,
            movementType: stockMovements.movementType,
          })
          .from(stockMovements)
          .where(eq(stockMovements.id, String(id)))
          .limit(1);

        if (!existingTx || existingTx.movementType !== "SALIDA") return [];

        const stockNow = await computeStockForVariantInWarehouse(
          tx,
          vId,
          sourceWarehouseId,
        );
        const availableNow =
          stockNow +
          (existingTx.inventoryItemId === itemId &&
          existingTx.fromWarehouseId === sourceWarehouseId &&
          (existingTx.variantId ?? "") === vId
            ? asNumber(existingTx.quantity)
            : 0);

        if (qty > availableNow) {
          throw new Error("Stock insuficiente");
        }

        const rows = await tx
          .update(stockMovements)
          .set({
            inventoryItemId: itemId,
            fromWarehouseId: sourceWarehouseId,
            toWarehouseId: null,
            quantity: String(qty),
            reason: mapReasonToEnum(reasonText),
            notes: reasonText,
            variantId: vId || null,
            referenceType: ordId ? "ORDER_ITEM" : "MANUAL",
            referenceId: ordId || null,
          })
          .where(eq(stockMovements.id, String(id)))
          .returning();

        await syncInventoryForItem(tx, existingTx.inventoryItemId ?? itemId);
        if (existingTx.variantId)
          await syncInventoryForVariant(tx, existingTx.variantId);
        if (vId && existingTx.variantId !== vId)
          await syncInventoryForVariant(tx, vId);
        if (
          existingTx.inventoryItemId &&
          existingTx.inventoryItemId !== itemId
        ) {
          await syncInventoryForItem(tx, itemId);
        }

        return rows;
      })
      .catch((e) => {
        if (
          String((e as { message?: string })?.message ?? "") ===
          "Stock insuficiente"
        ) {
          return "__stock" as const;
        }
        throw e;
      });

    if (updated === "__stock") {
      return jsonError(422, "INSUFFICIENT_STOCK", "Stock insuficiente", {
        quantity: ["La cantidad excede el disponible."],
      });
    }

    if (Array.isArray(updated) && updated.length === 0) {
      return jsonError(404, "ENTRY_NOT_FOUND", "Not found");
    }

    return Response.json(updated);
  } catch (error) {
    const response = dbJsonError(error, "No se pudo editar la salida.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo editar la salida.");
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-outputs:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");

  if (forbidden) {
    return jsonError(
      403,
      "FORBIDDEN",
      "No tienes permisos para eliminar salidas.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "El cuerpo de la solicitud no es JSON válido.",
      {
        body: ["Envía un JSON válido."],
      },
    );
  }

  const parsed = inventoryOutputDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Los datos para eliminar salida son inválidos.",
    );
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

      if (!existing || existing.movementType !== "SALIDA") return [];

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
    const response = dbJsonError(error, "No se pudo eliminar la salida.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo eliminar la salida.");
  }
}
