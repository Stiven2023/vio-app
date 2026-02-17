import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { categories } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "categories:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(categories);

    const items = await db
      .select()
      .from(categories)
      .limit(pageSize)
      .offset(offset);
    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar categorías", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "categories:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const { name } = await request.json();
  const n = String(name ?? "").trim();

  if (!n) {
    return new Response("name required", { status: 400 });
  }

  try {
    const created = await db.insert(categories).values({ name: n }).returning();

    return Response.json(created, { status: 201 });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? (e as { code?: string }).code
        : undefined;

    if (code === "23505") {
      return new Response("La categoría ya existe", { status: 409 });
    }

    return new Response("No se pudo crear la categoría", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "categories:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const { id, name } = await request.json();

  if (!id) {
    return new Response("Category ID required", { status: 400 });
  }

  const n = String(name ?? "").trim();

  if (!n) {
    return new Response("name required", { status: 400 });
  }

  try {
    const updated = await db
      .update(categories)
      .set({ name: n })
      .where(eq(categories.id, String(id)))
      .returning();

    return Response.json(updated);
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? (e as { code?: string }).code
        : undefined;

    if (code === "23505") {
      return new Response("La categoría ya existe", { status: 409 });
    }

    return new Response("No se pudo actualizar la categoría", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "categories:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "ELIMINAR_ITEM_INVENTARIO",
  );

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Category ID required", { status: 400 });
  }

  try {
    const deleted = await db
      .delete(categories)
      .where(eq(categories.id, String(id)))
      .returning();

    return Response.json(deleted);
  } catch {
    return new Response(
      "No se pudo eliminar. Verifica si la categoría está en uso.",
      { status: 409 },
    );
  }
}
