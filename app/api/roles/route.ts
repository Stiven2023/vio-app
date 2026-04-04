import { eq, inArray, not, sql } from "drizzle-orm";

import { erpDb, iamDb } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import { rolePermissions, roles } from "@/src/db/iam/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { isLegacyMigratedRole } from "@/src/utils/legacy-roles";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

const LEGACY_ROLE_SQL_PATTERN = "LEGACY_MIGRATED_ROLE_%";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "roles:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_ROL");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const [{ total }] = await iamDb
      .select({ total: sql<number>`count(*)::int` })
      .from(roles)
      .where(not(sql`${roles.name} like ${LEGACY_ROLE_SQL_PATTERN}`));
    const items = await iamDb
      .select()
      .from(roles)
      .where(not(sql`${roles.name} like ${LEGACY_ROLE_SQL_PATTERN}`))
      .limit(pageSize)
      .offset(offset);
    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar roles", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "roles:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ROL");

  if (forbidden) return forbidden;
  const { name } = await request.json();

  if (!name || typeof name !== "string" || name.trim() === "") {
    return new Response("Role name is required", { status: 400 });
  }
  if (isLegacyMigratedRole(name)) {
    return new Response("Legacy migrated role names are reserved", {
      status: 400,
    });
  }
  // Check for duplicate
  const exists = await iamDb.select().from(roles).where(eq(roles.name, name));

  if (exists.length > 0) {
    return new Response("Role already exists", { status: 409 });
  }
  const newRole = await iamDb.insert(roles).values({ name }).returning();

  return Response.json(newRole);
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "roles:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_ROL");

  if (forbidden) return forbidden;
  const { id, name } = await request.json();

  if (!id || typeof id !== "string" || id.trim() === "") {
    return new Response("Role ID is required", { status: 400 });
  }
  if (!name || typeof name !== "string" || name.trim() === "") {
    return new Response("Role name is required", { status: 400 });
  }
  if (isLegacyMigratedRole(name)) {
    return new Response("Legacy migrated role names are reserved", {
      status: 400,
    });
  }
  // Check if role exists
  const exists = await iamDb.select().from(roles).where(eq(roles.id, id));

  if (exists.length === 0) {
    return new Response("Role not found", { status: 404 });
  }
  if (isLegacyMigratedRole(exists[0]?.name)) {
    return new Response("Legacy migrated roles cannot be edited from this endpoint", {
      status: 400,
    });
  }
  // Check for duplicate name
  const duplicate = await iamDb.select().from(roles).where(eq(roles.name, name));

  if (duplicate.length > 0 && duplicate[0].id !== id) {
    return new Response("Role name already in use", { status: 409 });
  }
  const updated = await iamDb
    .update(roles)
    .set({ name })
    .where(eq(roles.id, id))
    .returning();

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "roles:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_ROL");

  if (forbidden) return forbidden;
  const { id } = await request.json();

  if (!id || typeof id !== "string" || id.trim() === "") {
    return new Response("Role ID is required", { status: 400 });
  }
  // Check if role exists
  const exists = await iamDb.select().from(roles).where(eq(roles.id, id));

  if (exists.length === 0) {
    return new Response("Role not found", { status: 404 });
  }
  const affectedEmployees = await erpDb
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.roleId, id));

  if (affectedEmployees.length > 0) {
    await erpDb
      .update(employees)
      .set({ roleId: null })
      .where(eq(employees.roleId, id));
  }

  try {
    const deleted = await iamDb.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));

      return tx.delete(roles).where(eq(roles.id, id)).returning();
    });

    return Response.json(deleted);
  } catch (error) {
    if (affectedEmployees.length > 0) {
      await erpDb
        .update(employees)
        .set({ roleId: id })
        .where(
          inArray(
            employees.id,
            affectedEmployees.map((employee) => employee.id),
          ),
        );
    }

    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo eliminar rol", { status: 500 });
  }
}
