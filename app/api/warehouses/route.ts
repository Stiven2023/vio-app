import { desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { warehouseStock, warehouses } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function normalizeCode(v: unknown) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_")
    .slice(0, 30);
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouses:get",
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
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudieron consultar bodegas", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouses:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  const {
    code,
    name,
    description,
    isVirtual,
    isExternal,
    address,
    city,
    department,
    isActive,
  } = await request.json();

  const normalizedCode = normalizeCode(code);
  const normalizedName = String(name ?? "").trim();

  if (!normalizedCode) return new Response("code required", { status: 400 });
  if (!normalizedName) return new Response("name required", { status: 400 });

  const created = await db
    .insert(warehouses)
    .values({
      code: normalizedCode,
      name: normalizedName,
      description: String(description ?? "").trim() || null,
      isVirtual: Boolean(isVirtual),
      isExternal: Boolean(isExternal),
      address: String(address ?? "").trim() || null,
      city: String(city ?? "").trim() || "Medellín",
      department: String(department ?? "").trim() || "ANTIOQUIA",
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    })
    .returning();

  return Response.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouses:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  const {
    id,
    code,
    name,
    description,
    isVirtual,
    isExternal,
    address,
    city,
    department,
    isActive,
  } = await request.json();

  const warehouseId = String(id ?? "").trim();
  const normalizedCode = normalizeCode(code);
  const normalizedName = String(name ?? "").trim();

  if (!warehouseId) return new Response("id required", { status: 400 });
  if (!normalizedCode) return new Response("code required", { status: 400 });
  if (!normalizedName) return new Response("name required", { status: 400 });

  const updated = await db
    .update(warehouses)
    .set({
      code: normalizedCode,
      name: normalizedName,
      description: String(description ?? "").trim() || null,
      isVirtual: Boolean(isVirtual),
      isExternal: Boolean(isExternal),
      address: String(address ?? "").trim() || null,
      city: String(city ?? "").trim() || "Medellín",
      department: String(department ?? "").trim() || "ANTIOQUIA",
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    })
    .where(eq(warehouses.id, warehouseId))
    .returning();

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "warehouses:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  const { id } = await request.json();
  const warehouseId = String(id ?? "").trim();

  if (!warehouseId) return new Response("id required", { status: 400 });

  const [stockRef] = await db
    .select({ id: warehouseStock.id })
    .from(warehouseStock)
    .where(eq(warehouseStock.warehouseId, warehouseId))
    .limit(1);

  if (stockRef) {
    return new Response("No se puede eliminar: la bodega tiene stock asociado", {
      status: 409,
    });
  }

  const deleted = await db
    .delete(warehouses)
    .where(eq(warehouses.id, warehouseId))
    .returning();

  return Response.json(deleted);
}
