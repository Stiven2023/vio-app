import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { productPrices } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function toNullableString(v: unknown) {
  const s = String(v ?? "").trim();

  return s ? s : null;
}

function toNullableNumericString(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));

  if (Number.isNaN(n)) return null;

  return String(n);
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "productPrices:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(productPrices);

  const items = await db
    .select()
    .from(productPrices)
    .limit(pageSize)
    .offset(offset);
  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "productPrices:post",
    limit: 80,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const {
    productId,
    referenceCode,
    priceCOP,
    priceUSD,
    startDate,
    endDate,
    isActive,
  } = await request.json();

  const pid = String(productId ?? "").trim();
  const ref = String(referenceCode ?? "").trim();

  if (!pid || !ref) {
    return new Response("productId and referenceCode required", {
      status: 400,
    });
  }

  try {
    const created = await db
      .insert(productPrices)
      .values({
        productId: pid,
        referenceCode: ref,
        priceCOP: toNullableNumericString(priceCOP),
        priceUSD: toNullableNumericString(priceUSD),
        startDate: startDate ? new Date(String(startDate)) : null,
        endDate: endDate ? new Date(String(endDate)) : null,
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
      return new Response("El código de referencia ya existe", { status: 409 });
    }

    return new Response("No se pudo crear el precio", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "productPrices:put",
    limit: 140,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const {
    id,
    productId,
    referenceCode,
    priceCOP,
    priceUSD,
    startDate,
    endDate,
    isActive,
  } = await request.json();

  if (!id) {
    return new Response("Price ID required", { status: 400 });
  }

  const patch: Partial<typeof productPrices.$inferInsert> = {
    isActive,
  };

  if (productId !== undefined) patch.productId = toNullableString(productId);
  if (referenceCode !== undefined)
    patch.referenceCode = String(referenceCode ?? "").trim();
  if (priceCOP !== undefined)
    patch.priceCOP = toNullableNumericString(priceCOP);
  if (priceUSD !== undefined)
    patch.priceUSD = toNullableNumericString(priceUSD);
  if (startDate !== undefined)
    patch.startDate = startDate ? new Date(String(startDate)) : null;
  if (endDate !== undefined)
    patch.endDate = endDate ? new Date(String(endDate)) : null;

  try {
    const updated = await db
      .update(productPrices)
      .set(patch)
      .where(eq(productPrices.id, String(id)))
      .returning();

    return Response.json(updated);
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? (e as { code?: string }).code
        : undefined;

    if (code === "23505") {
      return new Response("El código de referencia ya existe", { status: 409 });
    }

    return new Response("No se pudo actualizar el precio", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "productPrices:delete",
    limit: 80,
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
    return new Response("Price ID required", { status: 400 });
  }

  const deleted = await db
    .delete(productPrices)
    .where(eq(productPrices.id, String(id)))
    .returning();

  return Response.json(deleted);
}
