import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  employees,
  inventoryItems,
  inventoryItemVariants,
  stockMovements,
  warehouses,
} from "@/src/db/erp/schema";
import { dbJsonError, jsonError, jsonForbidden, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import {
  computeStockForVariantInWarehouse,
  syncInventoryForItem,
  syncInventoryForVariant,
} from "@/src/utils/inventory-sync";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import {
  toPositiveNumber,
  warehouseTransferActionSchema,
  warehouseTransferCreateSchema,
  warehouseTransferDeleteSchema,
  warehouseTransferListQuerySchema,
} from "@/src/utils/warehouse-transfers-contract";

function ensureWarehouseRole(request: Request) {
  const role = getRoleFromRequest(request);
  const allowed = role === "ADMINISTRADOR" || role === "LIDER_SUMINISTROS";

  return allowed ? null : jsonForbidden("No tienes permisos para gestionar traslados de bodega.");
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouse-transfers:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const roleForbidden = ensureWarehouseRole(request);

  if (roleForbidden) return roleForbidden;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para registrar traslados.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = warehouseTransferCreateSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos del traslado son inválidos.");
  }

  const itemId = parsed.data.inventoryItemId;
  const vId = parsed.data.variantId;
  const fromId = parsed.data.fromWarehouseId;
  const toId = parsed.data.toWarehouseId;
  const qty = parsed.data.quantity;
  const transferNotes = String(parsed.data.notes ?? "").trim();
  const asRequest = Boolean(parsed.data.isRequest);
  const requesterCodeValue = String(parsed.data.requesterCode ?? "")
    .trim()
    .toUpperCase();

  try {
    const [fromWarehouse, toWarehouse] = await Promise.all([
      db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(eq(warehouses.id, fromId))
        .limit(1),
      db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(eq(warehouses.id, toId))
        .limit(1),
    ]);

    if (!fromWarehouse[0] || !toWarehouse[0]) {
      return jsonError(404, "WAREHOUSE_NOT_FOUND", "warehouse not found", {
        warehouseId: ["La bodega origen o destino no existe."],
      });
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
      return jsonError(404, "VARIANT_NOT_FOUND", "variant not found", {
        variantId: ["La variante no existe para el inventario seleccionado."],
      });
    }

    const available = await computeStockForVariantInWarehouse(db, vId, fromId);

    if (!Number.isFinite(available) || qty > available) {
      return jsonError(422, "INSUFFICIENT_STOCK", "Stock insuficiente en bodega origen", {
        quantity: ["La cantidad excede el disponible en bodega origen."],
      });
    }

    const employeeId = getEmployeeIdFromRequest(request);

    let actorEmployeeId = employeeId;

    if (requesterCodeValue) {
      const [employeeByCode] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.employeeCode, requesterCodeValue))
        .limit(1);

      if (!employeeByCode?.id) {
        return jsonError(422, "REQUESTER_CODE_NOT_FOUND", "requesterCode not found", {
          requesterCode: ["No existe un empleado con ese código."],
        });
      }

      actorEmployeeId = employeeByCode.id;
    }

    if (!actorEmployeeId) {
      return jsonError(401, "UNAUTHENTICATED", "requester not resolved");
    }

    const created = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(stockMovements)
        .values({
          movementType: "TRASLADO",
          reason: "TRASLADO_INTERNO",
          notes: transferNotes || null,
          inventoryItemId: itemId,
          variantId: vId,
          fromWarehouseId: fromId,
          toWarehouseId: toId,
          quantity: String(qty),
          referenceType: "MANUAL",
          referenceId: null,
          transferStatus: asRequest ? "PENDIENTE" : null,
          requestedBy: asRequest ? actorEmployeeId : null,
          requestedAt: asRequest ? new Date() : null,
          createdBy: asRequest ? null : actorEmployeeId,
        })
        .returning();

      if (!asRequest) {
        await syncInventoryForItem(tx, itemId);
        await syncInventoryForVariant(tx, vId);
      }

      return rows;
    });

    return Response.json(created, { status: asRequest ? 202 : 201 });
  } catch (error) {
    const response = dbJsonError(error, "No se pudo registrar el traslado de bodega.");
    if (response) return response;
    return jsonError(500, "INTERNAL_ERROR", "No se pudo registrar el traslado de bodega.");
  }
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouse-transfers:get",
    limit: 240,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const roleForbidden = ensureWarehouseRole(request);

  if (roleForbidden) return roleForbidden;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para consultar traslados.");
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = warehouseTransferListQuerySchema.safeParse({
    warehouseId: String(searchParams.get("warehouseId") ?? "").trim(),
    scope: String(searchParams.get("scope") ?? "incoming").trim().toLowerCase(),
    status: String(searchParams.get("status") ?? "pending").trim().toLowerCase(),
  });

  if (!parsedQuery.success) {
    return zodFirstErrorEnvelope(parsedQuery.error, "Los filtros de traslados son inválidos.");
  }

  const { warehouseId, scope, status } = parsedQuery.data;

  const scopeWhere =
    scope === "outgoing"
      ? eq(stockMovements.fromWarehouseId, warehouseId)
      : eq(stockMovements.toWarehouseId, warehouseId);

  const pendingWhere = and(
    scopeWhere,
    eq(stockMovements.transferStatus, "PENDIENTE"),
  );

  const resolvedWhere = and(
    scopeWhere,
    sql`${stockMovements.transferStatus} in ('APROBADA', 'RECHAZADA')`,
  );

  const where = status === "resolved" ? resolvedWhere : pendingWhere;

  try {
    const items = await db
      .select({
      id: stockMovements.id,
      inventoryItemId: stockMovements.inventoryItemId,
      variantId: stockMovements.variantId,
      itemCode: inventoryItems.itemCode,
      itemName: inventoryItems.name,
      variantSku: inventoryItemVariants.sku,
      quantity: stockMovements.quantity,
      notes: stockMovements.notes,
      transferStatus: stockMovements.transferStatus,
      fromWarehouseId: stockMovements.fromWarehouseId,
      toWarehouseId: stockMovements.toWarehouseId,
      requestedAt: stockMovements.requestedAt,
      requesterEmployeeCode: sql<string | null>`(
        select e.employee_code
        from employees e
        where e.id = ${stockMovements.requestedBy}
        limit 1
      )`,
      requesterEmployeeName: sql<string | null>`(
        select e.name
        from employees e
        where e.id = ${stockMovements.requestedBy}
        limit 1
      )`,
      approverEmployeeCode: sql<string | null>`(
        select e.employee_code
        from employees e
        where e.id = ${stockMovements.createdBy}
        limit 1
      )`,
      approverEmployeeName: sql<string | null>`(
        select e.name
        from employees e
        where e.id = ${stockMovements.createdBy}
        limit 1
      )`,
      })
      .from(stockMovements)
      .leftJoin(
        inventoryItems,
        eq(stockMovements.inventoryItemId, inventoryItems.id),
      )
      .leftJoin(
        inventoryItemVariants,
        eq(stockMovements.variantId, inventoryItemVariants.id),
      )
      .where(where)
      .orderBy(desc(stockMovements.requestedAt));

    return Response.json({ items });
  } catch (error) {
    const response = dbJsonError(error, "No se pudieron consultar los traslados de bodega.");
    if (response) return response;
    return jsonError(500, "INTERNAL_ERROR", "No se pudieron consultar los traslados de bodega.");
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouse-transfers:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const roleForbidden = ensureWarehouseRole(request);

  if (roleForbidden) return roleForbidden;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para aprobar traslados.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = warehouseTransferActionSchema.safeParse(body);
  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos para aprobar traslado son inválidos.");
  }

  const requestId = parsed.data.id;
  const approvalNotes = String(parsed.data.notes ?? "").trim();

  const [pending] = await db
    .select({
      id: stockMovements.id,
      inventoryItemId: stockMovements.inventoryItemId,
      variantId: stockMovements.variantId,
      fromWarehouseId: stockMovements.fromWarehouseId,
      quantity: stockMovements.quantity,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.id, requestId),
        eq(stockMovements.transferStatus, "PENDIENTE"),
      ),
    )
    .limit(1);

  if (!pending) {
    return jsonError(404, "TRANSFER_REQUEST_NOT_FOUND", "transfer request not found");
  }
  if (!pending.inventoryItemId || !pending.fromWarehouseId) {
    return jsonError(422, "INVALID_TRANSFER_REQUEST", "invalid transfer request");
  }

  const pendingItemId = pending.inventoryItemId;
  const pendingFromWarehouseId = pending.fromWarehouseId;

  const qty = toPositiveNumber(pending.quantity);

  if (!qty) return jsonError(422, "INVALID_TRANSFER_QUANTITY", "invalid quantity");

  if (!pending.variantId) {
    return jsonError(422, "INVALID_TRANSFER_REQUEST", "invalid transfer request without variant");
  }

  const pendingVariantId = pending.variantId;

  const available = await computeStockForVariantInWarehouse(
    db,
    pendingVariantId,
    pendingFromWarehouseId,
  );

  if (!Number.isFinite(available) || qty > available) {
    return jsonError(422, "INSUFFICIENT_STOCK", "Stock insuficiente en bodega origen", {
      quantity: ["La cantidad excede el disponible en bodega origen."],
    });
  }

  const employeeId = getEmployeeIdFromRequest(request);

  if (!employeeId) return jsonError(401, "UNAUTHENTICATED", "requester not resolved");

  try {
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(stockMovements)
        .set({
          requestedAt: null,
          createdBy: employeeId,
          transferStatus: "APROBADA",
          notes: approvalNotes || null,
        })
        .where(
          and(
            eq(stockMovements.id, requestId),
            eq(stockMovements.transferStatus, "PENDIENTE"),
          ),
        )
        .returning();

      await syncInventoryForItem(tx, pendingItemId);
      await syncInventoryForVariant(tx, pendingVariantId);

      return rows;
    });

    return Response.json(updated);
  } catch (error) {
    const response = dbJsonError(error, "No se pudo aprobar el traslado.");
    if (response) return response;
    return jsonError(500, "INTERNAL_ERROR", "No se pudo aprobar el traslado.");
  }
}

export async function PATCH(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouse-transfers:patch",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const roleForbidden = ensureWarehouseRole(request);

  if (roleForbidden) return roleForbidden;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para rechazar traslados.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = warehouseTransferActionSchema.safeParse(body);
  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos para rechazar traslado son inválidos.");
  }

  const requestId = parsed.data.id;
  const rejectionNotes = String(parsed.data.notes ?? "").trim();

  const employeeId = getEmployeeIdFromRequest(request);

  if (!employeeId) return jsonError(401, "UNAUTHENTICATED", "requester not resolved");

  try {
    const rejected = await db
      .update(stockMovements)
      .set({
        createdBy: employeeId,
        transferStatus: "RECHAZADA",
        notes: rejectionNotes || null,
      })
      .where(
        and(
          eq(stockMovements.id, requestId),
          eq(stockMovements.transferStatus, "PENDIENTE"),
        ),
      )
      .returning();

    if (!rejected.length) {
      return jsonError(404, "TRANSFER_REQUEST_NOT_FOUND", "transfer request not found");
    }

    return Response.json(rejected);
  } catch (error) {
    const response = dbJsonError(error, "No se pudo rechazar el traslado.");
    if (response) return response;
    return jsonError(500, "INTERNAL_ERROR", "No se pudo rechazar el traslado.");
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouse-transfers:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const roleForbidden = ensureWarehouseRole(request);

  if (roleForbidden) return roleForbidden;

  const forbidden = await requirePermission(request, "REGISTRAR_SALIDA");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para eliminar solicitudes de traslado.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = warehouseTransferDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos para eliminar traslado son inválidos.");
  }

  const requestId = parsed.data.id;

  try {
    const deleted = await db
      .delete(stockMovements)
      .where(
        and(
          eq(stockMovements.id, requestId),
          eq(stockMovements.transferStatus, "PENDIENTE"),
        ),
      )
      .returning();

    if (!deleted.length) {
      return jsonError(404, "TRANSFER_REQUEST_NOT_FOUND", "transfer request not found");
    }

    return Response.json(deleted);
  } catch (error) {
    const response = dbJsonError(error, "No se pudo eliminar la solicitud de traslado.");
    if (response) return response;
    return jsonError(500, "INTERNAL_ERROR", "No se pudo eliminar la solicitud de traslado.");
  }
}
