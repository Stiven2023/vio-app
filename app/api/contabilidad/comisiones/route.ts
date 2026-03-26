import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { advisorCommissionRates } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function toRate(value: unknown) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n) || n < 0 || n > 1) return null;

  return String(n);
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:comisiones:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CARTERA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();
    const activeOnly = String(searchParams.get("activeOnly") ?? "1") !== "0";

    const filters = [
      q ? ilike(advisorCommissionRates.advisorName, `%${q}%`) : undefined,
      activeOnly ? eq(advisorCommissionRates.isActive, true) : undefined,
    ].filter(Boolean);

    const where = filters.length ? and(...filters) : undefined;

    const countQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(advisorCommissionRates);

    const [{ total }] = where
      ? await countQuery.where(where)
      : await countQuery;

    const itemsQuery = db
      .select({
        id: advisorCommissionRates.id,
        advisorName: advisorCommissionRates.advisorName,
        rate: advisorCommissionRates.rate,
        isActive: advisorCommissionRates.isActive,
        createdAt: advisorCommissionRates.createdAt,
        updatedAt: advisorCommissionRates.updatedAt,
      })
      .from(advisorCommissionRates)
      .orderBy(desc(advisorCommissionRates.updatedAt))
      .limit(pageSize)
      .offset(offset);

    const items = where ? await itemsQuery.where(where) : await itemsQuery;

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

    return new Response("No se pudieron consultar las comisiones", {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:comisiones:post",
    limit: 80,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  try {
    const body = (await request.json()) as {
      advisorName?: unknown;
      rate?: unknown;
      isActive?: unknown;
    };

    const advisorName = String(body.advisorName ?? "").trim();

    if (!advisorName) {
      return new Response("advisorName is required", { status: 400 });
    }

    const rate = toRate(body.rate);

    if (rate === null) {
      return new Response("rate must be a valid decimal between 0 and 1", {
        status: 400,
      });
    }

    const isActive =
      body.isActive === undefined ? true : Boolean(body.isActive);

    const [existing] = await db
      .select({
        id: advisorCommissionRates.id,
      })
      .from(advisorCommissionRates)
      .where(eq(advisorCommissionRates.advisorName, advisorName))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(advisorCommissionRates)
        .set({
          rate,
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(advisorCommissionRates.id, existing.id))
        .returning();

      return Response.json(updated);
    }

    const [created] = await db
      .insert(advisorCommissionRates)
      .values({
        advisorName,
        rate,
        isActive,
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo guardar la comisión", { status: 500 });
  }
}
