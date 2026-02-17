import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { permissions, rolePermissions } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "permissions:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PERMISO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(permissions);
    const items = await db
      .select()
      .from(permissions)
      .limit(pageSize)
      .offset(offset);
    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar permisos", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "permissions:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PERMISO");

  if (forbidden) return forbidden;
  const { name } = await request.json();

  if (!name || typeof name !== "string" || name.trim() === "") {
    return new Response("Permission name is required", { status: 400 });
  }
  // Check for duplicate
  const exists = await db
    .select()
    .from(permissions)
    .where(eq(permissions.name, name));

  if (exists.length > 0) {
    return new Response("Permission already exists", { status: 409 });
  }
  const newPerm = await db.insert(permissions).values({ name }).returning();

  return Response.json(newPerm);
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "permissions:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PERMISO");

  if (forbidden) return forbidden;
  const { id, name } = await request.json();

  if (!id || typeof id !== "string" || id.trim() === "") {
    return new Response("Permission ID is required", { status: 400 });
  }
  if (!name || typeof name !== "string" || name.trim() === "") {
    return new Response("Permission name is required", { status: 400 });
  }
  // Check if permission exists
  const exists = await db
    .select()
    .from(permissions)
    .where(eq(permissions.id, id));

  if (exists.length === 0) {
    return new Response("Permission not found", { status: 404 });
  }
  // Check for duplicate name
  const duplicate = await db
    .select()
    .from(permissions)
    .where(eq(permissions.name, name));

  if (duplicate.length > 0 && duplicate[0].id !== id) {
    return new Response("Permission name already in use", { status: 409 });
  }
  const updated = await db
    .update(permissions)
    .set({ name })
    .where(eq(permissions.id, id))
    .returning();

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "permissions:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_PERMISO");

  if (forbidden) return forbidden;
  const { id } = await request.json();

  if (!id || typeof id !== "string" || id.trim() === "") {
    return new Response("Permission ID is required", { status: 400 });
  }
  // Check if permission exists
  const exists = await db
    .select()
    .from(permissions)
    .where(eq(permissions.id, id));

  if (exists.length === 0) {
    return new Response("Permission not found", { status: 404 });
  }
  const deleted = await db.transaction(async (tx) => {
    await tx
      .delete(rolePermissions)
      .where(eq(rolePermissions.permissionId, id));

    return tx.delete(permissions).where(eq(permissions.id, id)).returning();
  });

  return Response.json(deleted);
}
