import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "clients:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CLIENTE");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(clients);

    const items = await db
      .select()
      .from(clients)
      .limit(pageSize)
      .offset(offset);
    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar clientes", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "clients:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_CLIENTE");

  if (forbidden) return forbidden;

  const { name, identification, email, phone, city, isActive } =
    await request.json();

  const n = String(name ?? "").trim();
  const idn = String(identification ?? "").trim();

  if (!n || !idn) {
    return new Response("name and identification required", { status: 400 });
  }

  try {
    const created = await db
      .insert(clients)
      .values({
        name: n,
        identification: idn,
        email: email ? String(email).trim() : null,
        phone: phone ? String(phone).trim() : null,
        city: city ? String(city).trim() : undefined,
        isActive: isActive ?? true,
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? (e as { code?: string }).code
        : undefined;

    if (code === "23505") {
      return new Response("La identificación ya existe", { status: 409 });
    }

    return new Response("No se pudo crear el cliente", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "clients:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_CLIENTE");

  if (forbidden) return forbidden;

  const { id, name, identification, email, phone, city, isActive } =
    await request.json();

  if (!id) {
    return new Response("Client ID required", { status: 400 });
  }

  const patch: Partial<typeof clients.$inferInsert> = {
    isActive,
  };

  if (name !== undefined) patch.name = String(name).trim();
  if (identification !== undefined)
    patch.identification = String(identification).trim();
  if (email !== undefined) patch.email = email ? String(email).trim() : null;
  if (phone !== undefined) patch.phone = phone ? String(phone).trim() : null;
  if (city !== undefined) patch.city = city ? String(city).trim() : null;

  try {
    const updated = await db
      .update(clients)
      .set(patch)
      .where(eq(clients.id, String(id)))
      .returning();

    return Response.json(updated);
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? (e as { code?: string }).code
        : undefined;

    if (code === "23505") {
      return new Response("La identificación ya existe", { status: 409 });
    }

    return new Response("No se pudo actualizar el cliente", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "clients:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_CLIENTE");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Client ID required", { status: 400 });
  }

  const deleted = await db
    .delete(clients)
    .where(eq(clients.id, String(id)))
    .returning();

  return Response.json(deleted);
}
