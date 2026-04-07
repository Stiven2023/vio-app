import { desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { warehouseStock, warehouses } from "@/src/db/erp/schema";
import { dbJsonError, jsonError, jsonForbidden, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import {
  normalizeWarehouseCode,
  warehouseIdSchema,
  warehouseMutationSchema,
} from "@/src/utils/warehouses-contract";

function ensureWarehouseRole(request: Request) {
  const role = getRoleFromRequest(request);
  const allowed = role === "ADMINISTRADOR" || role === "LIDER_SUMINISTROS";

  return allowed ? null : jsonForbidden("No tienes permisos para consultar bodegas.");
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouses:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const roleForbidden = ensureWarehouseRole(request);

  if (roleForbidden) return roleForbidden;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para consultar bodegas.");
  }

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();

    const where = q ? ilike(warehouses.name, `%${q}%`) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(warehouses)
      .where(where);

    const items = await db
      .select({
        id: warehouses.id,
        code: warehouses.code,
        name: warehouses.name,
        description: warehouses.description,
        purpose: warehouses.purpose,
        isVirtual: warehouses.isVirtual,
        isExternal: warehouses.isExternal,
        address: warehouses.address,
        city: warehouses.city,
        department: warehouses.department,
        isActive: warehouses.isActive,
        createdAt: warehouses.createdAt,
      })
      .from(warehouses)
      .where(where)
      .orderBy(desc(warehouses.createdAt))
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbJsonError(error, "No se pudieron consultar bodegas.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudieron consultar bodegas.");
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouses:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const roleForbidden = ensureWarehouseRole(request);

  if (roleForbidden) return roleForbidden;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para crear bodegas.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = warehouseMutationSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos de la bodega son inválidos.");
  }

  const payload = parsed.data;

  try {
    const created = await db
      .insert(warehouses)
      .values({
        code: normalizeWarehouseCode(payload.code),
        name: payload.name,
        description: payload.description,
        purpose: payload.purpose,
        isVirtual: payload.isVirtual,
        isExternal: payload.isExternal,
        address: payload.address,
        city: payload.city,
        department: payload.department,
        isActive: payload.isActive,
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbJsonError(error, "No se pudo crear la bodega.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo crear la bodega.");
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouses:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const roleForbidden = ensureWarehouseRole(request);

  if (roleForbidden) return roleForbidden;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para editar bodegas.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const idParsed = warehouseIdSchema.safeParse(body);
  if (!idParsed.success) {
    return zodFirstErrorEnvelope(idParsed.error, "El id de bodega es obligatorio.");
  }

  const warehouseId = idParsed.data.id;
  const mutationParsed = warehouseMutationSchema.safeParse(body);
  if (!mutationParsed.success) {
    return zodFirstErrorEnvelope(mutationParsed.error, "Los datos de la bodega son inválidos.");
  }

  const payload = mutationParsed.data;

  try {
    const updated = await db
      .update(warehouses)
      .set({
        code: normalizeWarehouseCode(payload.code),
        name: payload.name,
        description: payload.description,
        purpose: payload.purpose,
        isVirtual: payload.isVirtual,
        isExternal: payload.isExternal,
        address: payload.address,
        city: payload.city,
        department: payload.department,
        isActive: payload.isActive,
      })
      .where(eq(warehouses.id, warehouseId))
      .returning();

    return Response.json(updated);
  } catch (error) {
    const response = dbJsonError(error, "No se pudo editar la bodega.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo editar la bodega.");
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouses:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const roleForbidden = ensureWarehouseRole(request);

  if (roleForbidden) return roleForbidden;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para eliminar bodegas.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = warehouseIdSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "El id de bodega es obligatorio.");
  }

  const warehouseId = parsed.data.id;

  const [stockRef] = await db
    .select({ id: warehouseStock.id })
    .from(warehouseStock)
    .where(eq(warehouseStock.warehouseId, warehouseId))
    .limit(1);

  if (stockRef) {
    return jsonError(
      409,
      "WAREHOUSE_STOCK_CONFLICT",
      "No se puede eliminar: la bodega tiene stock asociado.",
      {
        id: ["Primero elimina o traslada el stock asociado."],
      },
    );
  }

  try {
    const deleted = await db
      .delete(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .returning();

    return Response.json(deleted);
  } catch (error) {
    const response = dbJsonError(error, "No se pudo eliminar la bodega.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo eliminar la bodega.");
  }
}
