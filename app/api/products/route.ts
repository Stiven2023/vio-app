import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { categories, products } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function normalizeProductCodePrefix(categoryName: string) {
  const cleaned = String(categoryName)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return cleaned.slice(0, 3).padEnd(3, "X");
}

async function buildNextProductCode(categoryId: string) {
  const [category] = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!category) {
    return new Response("Categoría inválida", { status: 400 });
  }

  const prefix = normalizeProductCodePrefix(category.name);

  const [row] = await db
    .select({
      maxSuffix: sql<number>`max(nullif(substring(${products.productCode}, 4, 2), '')::int)`,
    })
    .from(products)
    .where(sql`${products.productCode} like ${prefix + "%"}`);

  const nextSuffix = (row?.maxSuffix ?? 0) + 1;

  if (nextSuffix > 99) {
    return new Response(
      "Se alcanzó el máximo de códigos para esta categoría",
      { status: 409 },
    );
  }

  return `${prefix}${String(nextSuffix).padStart(2, "0")}`;
}

function toNullableNumericString(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));

  if (Number.isNaN(n)) return null;

  return String(n);
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "products:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    // Obtener todos los productos activos
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(products)
      .where(sql`${products.isActive} = true`);

    const items = await db
      .select()
      .from(products)
      .where(sql`${products.isActive} = true`)
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar productos", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "products:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const {
    name,
    description,
    categoryId,
    priceCopBase,
    priceCopInternational,
    priceCopR1,
    priceCopR2,
    priceCopR3,
    priceColanta,
    priceMayorista,
    priceUSD,
    trmUsed,
    startDate,
    endDate,
    isActive,
  } = await request.json();

  const n = String(name ?? "").trim();

  if (!n) {
    return new Response("name required", { status: 400 });
  }

  const categoryIdValue = String(categoryId ?? "").trim();

  if (!categoryIdValue) {
    return new Response("categoryId required", { status: 400 });
  }

  const productCode = await buildNextProductCode(categoryIdValue);

  if (productCode instanceof Response) return productCode;

  try {
    const created = await db
      .insert(products)
      .values({
        productCode,
        name: n,
        description: description ? String(description) : null,
        categoryId: categoryIdValue,
        priceCopBase: toNullableNumericString(priceCopBase),
        priceCopInternational: toNullableNumericString(priceCopInternational),
        priceCopR1: toNullableNumericString(priceCopR1),
        priceCopR2: toNullableNumericString(priceCopR2),
        priceCopR3: toNullableNumericString(priceCopR3),
        priceViomar: null,
        priceColanta: toNullableNumericString(priceColanta),
        priceMayorista: toNullableNumericString(priceMayorista),
        priceUSD: toNullableNumericString(priceUSD),
        trmUsed: toNullableNumericString(trmUsed),
        startDate: startDate ? new Date(String(startDate)) : null,
        endDate: endDate ? new Date(String(endDate)) : null,
        isActive: isActive ?? true,
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo crear el producto", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "products:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const {
    id,
    name,
    description,
    categoryId,
    priceCopBase,
    priceCopInternational,
    priceCopR1,
    priceCopR2,
    priceCopR3,
    priceColanta,
    priceMayorista,
    priceUSD,
    trmUsed,
    startDate,
    endDate,
    isActive,
  } = await request.json();

  if (!id) {
    return new Response("Product ID required", { status: 400 });
  }

  try {
    const updated = await db
      .update(products)
      .set({
        name: name ? String(name) : undefined,
        description: description !== undefined ? (description ? String(description) : null) : undefined,
        categoryId: categoryId ? String(categoryId) : undefined,
        priceCopBase: priceCopBase !== undefined ? toNullableNumericString(priceCopBase) : undefined,
        priceCopInternational: priceCopInternational !== undefined ? toNullableNumericString(priceCopInternational) : undefined,
        priceCopR1: priceCopR1 !== undefined ? toNullableNumericString(priceCopR1) : undefined,
        priceCopR2: priceCopR2 !== undefined ? toNullableNumericString(priceCopR2) : undefined,
        priceCopR3: priceCopR3 !== undefined ? toNullableNumericString(priceCopR3) : undefined,
        priceColanta: priceColanta !== undefined ? toNullableNumericString(priceColanta) : undefined,
        priceMayorista: priceMayorista !== undefined ? toNullableNumericString(priceMayorista) : undefined,
        priceUSD: priceUSD !== undefined ? toNullableNumericString(priceUSD) : undefined,
        trmUsed: trmUsed !== undefined ? toNullableNumericString(trmUsed) : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(String(startDate)) : null) : undefined,
        endDate: endDate !== undefined ? (endDate ? new Date(String(endDate)) : null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      })
      .where(eq(products.id, String(id)))
      .returning();

    if (updated.length === 0) {
      return new Response("Producto no encontrado", { status: 404 });
    }

    return Response.json(updated[0]);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo actualizar el producto", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "products:delete",
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
    return new Response("Product ID required", { status: 400 });
  }

  try {
    const deleted = await db
      .delete(products)
      .where(eq(products.id, String(id)))
      .returning();

    return Response.json(deleted);
  } catch {
    return new Response(
      "No se pudo eliminar. Verifica si el producto tiene precios u órdenes asociadas.",
      { status: 409 },
    );
  }
}
