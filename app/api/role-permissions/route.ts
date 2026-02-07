import { eq, and, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { rolePermissions } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "rolePermissions:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_ROLE_PERMISSION");

  if (forbidden) return forbidden;
  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(rolePermissions);
  const items = await db
    .select()
    .from(rolePermissions)
    .limit(pageSize)
    .offset(offset);
  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "rolePermissions:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ROLE_PERMISSION");

  if (forbidden) return forbidden;
  const { roleId, permissionId } = await request.json();

  if (
    !roleId ||
    typeof roleId !== "string" ||
    roleId.trim() === "" ||
    !permissionId ||
    typeof permissionId !== "string" ||
    permissionId.trim() === ""
  ) {
    return new Response("roleId and permissionId are required", {
      status: 400,
    });
  }
  // Check for duplicate
  const exists = await db
    .select()
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.roleId, roleId),
        eq(rolePermissions.permissionId, permissionId),
      ),
    );

  if (exists.length > 0) {
    return new Response("Role-permission already exists", { status: 409 });
  }
  const newRolePerm = await db
    .insert(rolePermissions)
    .values({ roleId, permissionId })
    .returning();

  return Response.json(newRolePerm);
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "rolePermissions:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_ROLE_PERMISSION");

  if (forbidden) return forbidden;
  const { roleId, permissionId } = await request.json();

  if (
    !roleId ||
    typeof roleId !== "string" ||
    roleId.trim() === "" ||
    !permissionId ||
    typeof permissionId !== "string" ||
    permissionId.trim() === ""
  ) {
    return new Response("roleId and permissionId are required", {
      status: 400,
    });
  }
  // Check if exists
  const exists = await db
    .select()
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.roleId, roleId),
        eq(rolePermissions.permissionId, permissionId),
      ),
    );

  if (exists.length === 0) {
    return new Response("Role-permission not found", { status: 404 });
  }

  // Aquí deberías definir la lógica de edición, actualmente solo elimina
  // Por ejemplo, podrías actualizar algún campo adicional si existe
  return new Response("PUT endpoint implementado, pero sin lógica de edición", {
    status: 200,
  });
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "rolePermissions:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "ELIMINAR_ROLE_PERMISSION",
  );

  if (forbidden) return forbidden;
  const { roleId, permissionId } = await request.json();

  if (
    !roleId ||
    typeof roleId !== "string" ||
    roleId.trim() === "" ||
    !permissionId ||
    typeof permissionId !== "string" ||
    permissionId.trim() === ""
  ) {
    return new Response("roleId and permissionId are required", {
      status: 400,
    });
  }
  // Check if exists
  const exists = await db
    .select()
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.roleId, roleId),
        eq(rolePermissions.permissionId, permissionId),
      ),
    );

  if (exists.length === 0) {
    return new Response("Role-permission not found", { status: 404 });
  }
  const deleted = await db
    .delete(rolePermissions)
    .where(
      and(
        eq(rolePermissions.roleId, roleId),
        eq(rolePermissions.permissionId, permissionId),
      ),
    )
    .returning();

  return Response.json(deleted);
}
