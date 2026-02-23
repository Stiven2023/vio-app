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
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(products);

    const items = await db
      .select()
      .from(products)
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

  const { name, description, categoryId, isActive } = await request.json();

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

  const created = await db
    .insert(products)
    .values({
      productCode,
      name: n,
      description: description ? String(description) : null,
      categoryId: categoryIdValue,
      isActive: isActive ?? true,
    })
    .returning();

  return Response.json(created, { status: 201 });
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

  const { id, name, description, categoryId, isActive } = await request.json();

  if (!id) {
    return new Response("Product ID required", { status: 400 });
  }

  const [existing] = await db
    .select({
      categoryId: products.categoryId,
      productCode: products.productCode,
    })
    .from(products)
    .where(eq(products.id, String(id)))
    .limit(1);

  if (!existing) {
    return new Response("Product not found", { status: 404 });
  }

  const patch: Partial<typeof products.$inferInsert> = {
    isActive,
  };

  if (name !== undefined) patch.name = String(name).trim();
  if (description !== undefined)
    patch.description = description ? String(description) : null;
  const categoryIdValue =
    categoryId !== undefined ? String(categoryId ?? "").trim() : null;

  if (categoryId !== undefined && !categoryIdValue) {
    return new Response("categoryId required", { status: 400 });
  }

  if (categoryId !== undefined) {
    patch.categoryId = categoryIdValue;
  }

  const nextCategoryId = categoryIdValue ?? existing.categoryId;

  if (!nextCategoryId) {
    return new Response("categoryId required", { status: 400 });
  }

  const shouldRegenerateCode =
    !existing.productCode ||
    (categoryIdValue && categoryIdValue !== existing.categoryId);

  if (shouldRegenerateCode) {
    const productCode = await buildNextProductCode(nextCategoryId);

    if (productCode instanceof Response) return productCode;

    patch.productCode = productCode;
  }

  const updated = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, String(id)))
    .returning();

  return Response.json(updated);
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
