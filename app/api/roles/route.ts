import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { roles } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "roles:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_ROL");

  if (forbidden) return forbidden;
  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(roles);
  const items = await db.select().from(roles).limit(pageSize).offset(offset);
  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
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
  // Check for duplicate
  const exists = await db.select().from(roles).where(eq(roles.name, name));

  if (exists.length > 0) {
    return new Response("Role already exists", { status: 409 });
  }
  const newRole = await db.insert(roles).values({ name }).returning();

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
  // Check if role exists
  const exists = await db.select().from(roles).where(eq(roles.id, id));

  if (exists.length === 0) {
    return new Response("Role not found", { status: 404 });
  }
  // Check for duplicate name
  const duplicate = await db.select().from(roles).where(eq(roles.name, name));

  if (duplicate.length > 0 && duplicate[0].id !== id) {
    return new Response("Role name already in use", { status: 409 });
  }
  const updated = await db
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
  const exists = await db.select().from(roles).where(eq(roles.id, id));

  if (exists.length === 0) {
    return new Response("Role not found", { status: 404 });
  }
  const deleted = await db.delete(roles).where(eq(roles.id, id)).returning();

  return Response.json(deleted);
}
