import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  employees,
  inventoryItems,
  inventoryItemVariants,
  stockMovements,
  warehouses,
} from "@/src/db/schema";
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

function toPositiveNumber(v: unknown) {
  const n = Number(String(v));

  return Number.isFinite(n) && n > 0 ? n : null;
}

const REQUEST_PENDING_PREFIX = "[SOLICITUD PENDIENTE]";
const REQUEST_APPROVED_PREFIX = "[SOLICITUD APROBADA]";
const REQUEST_REJECTED_PREFIX = "[SOLICITUD RECHAZADA]";

function buildRequestNote(prefix: string, note: string) {
  const trimmed = String(note ?? "").trim();
  return trimmed ? `${prefix} ${trimmed}` : prefix;
}

function ensureWarehouseRole(request: Request) {
  const role = getRoleFromRequest(request);
  const allowed = role === "ADMINISTRADOR" || role === "LIDER_SUMINISTROS";

  return allowed ? null : new Response("Forbidden", { status: 403 });
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
  if (forbidden) return forbidden;

  const {
    inventoryItemId,
    variantId,
    fromWarehouseId,
    toWarehouseId,
    quantity,
    notes,
    isRequest,
    requesterCode,
  } = await request.json();

  const itemId = String(inventoryItemId ?? "").trim();
  const vId = String(variantId ?? "").trim();
  const fromId = String(fromWarehouseId ?? "").trim();
  const toId = String(toWarehouseId ?? "").trim();
  const qty = toPositiveNumber(quantity);
  const transferNotes = String(notes ?? "").trim();
  const asRequest = Boolean(isRequest);
  const requesterCodeValue = String(requesterCode ?? "").trim().toUpperCase();

  if (!itemId) return new Response("inventoryItemId required", { status: 400 });
  if (!vId) return new Response("variantId required", { status: 400 });
  if (!fromId) return new Response("fromWarehouseId required", { status: 400 });
  if (!toId) return new Response("toWarehouseId required", { status: 400 });
  if (fromId === toId) {
    return new Response("source and destination must be different", { status: 400 });
  }
  if (!qty) return new Response("quantity must be positive", { status: 400 });

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
    return new Response("warehouse not found", { status: 404 });
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

  if (!variantRow) return new Response("variant not found", { status: 404 });

  const available = await computeStockForVariantInWarehouse(db, vId, fromId);

  if (!Number.isFinite(available) || qty > available) {
    return new Response("Stock insuficiente en bodega origen", { status: 400 });
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
      return new Response("requesterCode not found", { status: 400 });
    }

    actorEmployeeId = employeeByCode.id;
  }

  if (!actorEmployeeId) {
    return new Response("requester not resolved", { status: 401 });
  }

  const created = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(stockMovements)
      .values({
        movementType: "TRASLADO",
        reason: "TRASLADO_INTERNO",
        notes: asRequest
          ? buildRequestNote(REQUEST_PENDING_PREFIX, transferNotes)
          : (transferNotes || null),
        inventoryItemId: itemId,
        variantId: vId,
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        quantity: String(qty),
        referenceType: "MANUAL",
        referenceId: null,
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
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const warehouseId = String(searchParams.get("warehouseId") ?? "").trim();
  const scope = String(searchParams.get("scope") ?? "incoming")
    .trim()
    .toLowerCase();
  const status = String(searchParams.get("status") ?? "pending")
    .trim()
    .toLowerCase();

  if (!warehouseId) return new Response("warehouseId required", { status: 400 });

  const scopeWhere =
    scope === "outgoing"
      ? eq(stockMovements.fromWarehouseId, warehouseId)
      : eq(stockMovements.toWarehouseId, warehouseId);

  const pendingWhere = and(
    scopeWhere,
    isNotNull(stockMovements.requestedAt),
    sql`(
      ${stockMovements.notes} is null
      or ${stockMovements.notes} ilike ${`${REQUEST_PENDING_PREFIX}%`}
    )`,
  );

  const resolvedWhere = and(
    scopeWhere,
    sql`(
      ${stockMovements.notes} ilike ${`${REQUEST_APPROVED_PREFIX}%`}
      or ${stockMovements.notes} ilike ${`${REQUEST_REJECTED_PREFIX}%`}
    )`,
  );

  const where = status === "resolved" ? resolvedWhere : pendingWhere;

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
      status: sql<"PENDIENTE" | "APROBADA" | "RECHAZADA">`
        case
          when ${stockMovements.notes} ilike ${`${REQUEST_APPROVED_PREFIX}%`} then 'APROBADA'
          when ${stockMovements.notes} ilike ${`${REQUEST_REJECTED_PREFIX}%`} then 'RECHAZADA'
          else 'PENDIENTE'
        end
      `,
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
    .leftJoin(inventoryItems, eq(stockMovements.inventoryItemId, inventoryItems.id))
    .leftJoin(inventoryItemVariants, eq(stockMovements.variantId, inventoryItemVariants.id))
    .where(where)
    .orderBy(desc(stockMovements.requestedAt));

  return Response.json({ items });
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
  if (forbidden) return forbidden;

  const { id, notes } = await request.json();
  const requestId = String(id ?? "").trim();
  const approvalNotes = String(notes ?? "").trim();

  if (!requestId) return new Response("id required", { status: 400 });

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
        isNotNull(stockMovements.requestedAt),
        sql`(
          ${stockMovements.notes} is null
          or ${stockMovements.notes} ilike ${`${REQUEST_PENDING_PREFIX}%`}
        )`,
      ),
    )
    .limit(1);

  if (!pending) return new Response("transfer request not found", { status: 404 });
  if (!pending.inventoryItemId || !pending.fromWarehouseId) {
    return new Response("invalid transfer request", { status: 400 });
  }

  const pendingItemId = pending.inventoryItemId;
  const pendingFromWarehouseId = pending.fromWarehouseId;

  const qty = toPositiveNumber(pending.quantity);
  if (!qty) return new Response("invalid quantity", { status: 400 });

  if (!pending.variantId) {
    return new Response("invalid transfer request without variant", {
      status: 400,
    });
  }

  const pendingVariantId = pending.variantId;

  const available = await computeStockForVariantInWarehouse(
    db,
    pendingVariantId,
    pendingFromWarehouseId,
  );

  if (!Number.isFinite(available) || qty > available) {
    return new Response("Stock insuficiente en bodega origen", { status: 400 });
  }

  const employeeId = getEmployeeIdFromRequest(request);
  if (!employeeId) return new Response("requester not resolved", { status: 401 });

  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .update(stockMovements)
      .set({
        requestedAt: null,
        createdBy: employeeId,
        notes: buildRequestNote(REQUEST_APPROVED_PREFIX, approvalNotes),
      })
      .where(
        and(
          eq(stockMovements.id, requestId),
          isNotNull(stockMovements.requestedAt),
          sql`(
            ${stockMovements.notes} is null
            or ${stockMovements.notes} ilike ${`${REQUEST_PENDING_PREFIX}%`}
          )`,
        ),
      )
      .returning();

    await syncInventoryForItem(tx, pendingItemId);
    await syncInventoryForVariant(tx, pendingVariantId);

    return rows;
  });

  return Response.json(updated);
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
  if (forbidden) return forbidden;

  const { id, notes } = await request.json();
  const requestId = String(id ?? "").trim();
  const rejectionNotes = String(notes ?? "").trim();

  if (!requestId) return new Response("id required", { status: 400 });

  const employeeId = getEmployeeIdFromRequest(request);
  if (!employeeId) return new Response("requester not resolved", { status: 401 });

  const rejected = await db
    .update(stockMovements)
    .set({
      createdBy: employeeId,
      notes: buildRequestNote(REQUEST_REJECTED_PREFIX, rejectionNotes),
    })
    .where(
      and(
        eq(stockMovements.id, requestId),
        isNotNull(stockMovements.requestedAt),
      ),
    )
    .returning();

  if (!rejected.length) {
    return new Response("transfer request not found", { status: 404 });
  }

  return Response.json(rejected);
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
  if (forbidden) return forbidden;

  const { id } = await request.json();
  const requestId = String(id ?? "").trim();

  if (!requestId) return new Response("id required", { status: 400 });

  const deleted = await db
    .delete(stockMovements)
    .where(
      and(
        eq(stockMovements.id, requestId),
        isNotNull(stockMovements.requestedAt),
      ),
    )
    .returning();

  if (!deleted.length) return new Response("transfer request not found", { status: 404 });

  return Response.json(deleted);
}
