import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employees } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "employees:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_EMPLEADO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(employees);

  const items = await db
    .select()
    .from(employees)
    .limit(pageSize)
    .offset(offset);
  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "employees:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_EMPLEADO");

  if (forbidden) return forbidden;

  const { userId, name, roleId, isActive } = await request.json();

  if (!userId || !name || !roleId) {
    return new Response("userId, name and roleId required", { status: 400 });
  }
  const newEmployee = await db
    .insert(employees)
    .values({ userId, name, roleId, isActive: isActive ?? true })
    .returning();

  return Response.json(newEmployee);
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "employees:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_EMPLEADO");

  if (forbidden) return forbidden;

  const { id, name, roleId, isActive } = await request.json();

  if (!id) {
    return new Response("Employee ID required", { status: 400 });
  }
  const updated = await db
    .update(employees)
    .set({ name, roleId, isActive })
    .where(eq(employees.id, id))
    .returning();

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "employees:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_EMPLEADO");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Employee ID required", { status: 400 });
  }
  const deleted = await db
    .delete(employees)
    .where(eq(employees.id, id))
    .returning();

  return Response.json(deleted);
}
