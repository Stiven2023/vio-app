import { and, asc, eq, ne, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { banks, purchaseOrders } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 30);
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "banks:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();

    const where = q
      ? sql`${banks.code} ilike ${`%${q}%`} or ${banks.name} ilike ${`%${q}%`} or ${banks.accountRef} ilike ${`%${q}%`}`
      : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(banks)
      .where(where);

    const items = await db
      .select()
      .from(banks)
      .where(where)
      .orderBy(asc(banks.name))
      .limit(pageSize)
      .offset(offset);

    return Response.json({
      items,
      page,
      pageSize,
      total,
      hasNextPage: offset + items.length < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar bancos", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "banks:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PAGO");

  if (forbidden) return forbidden;

  const body = await request.json();

  const code = normalizeCode(String(body?.code ?? ""));
  const name = String(body?.name ?? "").trim();
  const accountRef = String(body?.accountRef ?? "").trim();
  const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : true;

  if (!code) return new Response("code required", { status: 400 });
  if (!name) return new Response("name required", { status: 400 });
  if (!accountRef) return new Response("accountRef required", { status: 400 });

  try {
    const created = await db
      .insert(banks)
      .values({
        code,
        name,
        accountRef,
        isActive,
        updatedAt: new Date(),
      })
      .returning();

    return Response.json(created[0], { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear banco", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "banks:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PAGO");

  if (forbidden) return forbidden;

  const body = await request.json();

  const id = String(body?.id ?? "").trim();
  const code = normalizeCode(String(body?.code ?? ""));
  const name = String(body?.name ?? "").trim();
  const accountRef = String(body?.accountRef ?? "").trim();
  const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : true;

  if (!id) return new Response("id required", { status: 400 });
  if (!code) return new Response("code required", { status: 400 });
  if (!name) return new Response("name required", { status: 400 });
  if (!accountRef) return new Response("accountRef required", { status: 400 });

  try {
    const [existingCode] = await db
      .select({ id: banks.id })
      .from(banks)
      .where(and(eq(banks.code, code), ne(banks.id, id)))
      .limit(1);

    if (existingCode?.id) {
      return new Response("code already exists", { status: 409 });
    }

    const updated = await db
      .update(banks)
      .set({
        code,
        name,
        accountRef,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(banks.id, id))
      .returning();

    if (!updated[0]) return new Response("bank not found", { status: 404 });

    return Response.json(updated[0]);
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar banco", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "banks:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PAGO");

  if (forbidden) return forbidden;

  const body = await request.json();
  const id = String(body?.id ?? "").trim();

  if (!id) return new Response("id required", { status: 400 });

  try {
    const [usage] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.bankId, id));

    if ((usage?.total ?? 0) > 0) {
      const [updated] = await db
        .update(banks)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(banks.id, id))
        .returning();

      if (!updated) return new Response("bank not found", { status: 404 });

      return Response.json({
        deleted: false,
        deactivated: true,
        message: "El banco tiene ordenes asociadas y fue desactivado.",
      });
    }

    const [deleted] = await db
      .delete(banks)
      .where(eq(banks.id, id))
      .returning({ id: banks.id });

    if (!deleted?.id) return new Response("bank not found", { status: 404 });

    return Response.json({ deleted: true, deactivated: false });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo eliminar banco", { status: 500 });
  }
}
