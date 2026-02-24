import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { categories, productPrices, products } from "@/src/db/schema";
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

async function upsertPrimaryPrice(
  tx: any,
  args: {
    productId: string;
    referenceCode: string;
    priceCopR1?: unknown;
    priceCopR2?: unknown;
    priceCopR3?: unknown;
    priceViomar?: unknown;
    priceColanta?: unknown;
    priceMayorista?: unknown;
    priceUSD?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    isActive?: unknown;
  },
) {
  const [existing] = await tx
    .select({ id: productPrices.id, referenceCode: productPrices.referenceCode })
    .from(productPrices)
    .where(eq(productPrices.productId, args.productId))
    .orderBy(desc(productPrices.updatedAt))
    .limit(1);

  const values: typeof productPrices.$inferInsert = {
    productId: args.productId,
    referenceCode: existing?.referenceCode ?? args.referenceCode,
    priceCopR1: toNullableNumericString(args.priceCopR1),
    priceCopR2: toNullableNumericString(args.priceCopR2),
    priceCopR3: toNullableNumericString(args.priceCopR3),
    priceViomar: toNullableNumericString(args.priceViomar),
    priceColanta: toNullableNumericString(args.priceColanta),
    priceMayorista: toNullableNumericString(args.priceMayorista),
    priceUSD: toNullableNumericString(args.priceUSD),
    startDate: args.startDate ? new Date(String(args.startDate)) : null,
    endDate: args.endDate ? new Date(String(args.endDate)) : null,
    isActive: Boolean(args.isActive ?? true),
    updatedAt: new Date(),
  };

  if (existing) {
    await tx
      .update(productPrices)
      .set(values)
      .where(eq(productPrices.id, existing.id));

    return;
  }

  await tx.insert(productPrices).values(values);
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

  const {
    name,
    description,
    categoryId,
    priceCopR1,
    priceCopR2,
    priceCopR3,
    priceViomar,
    priceColanta,
    priceMayorista,
    priceUSD,
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

  const created = await db.transaction(async (tx) => {
    const createdProduct = await tx
      .insert(products)
      .values({
        productCode,
        name: n,
        description: description ? String(description) : null,
        categoryId: categoryIdValue,
        isActive: isActive ?? true,
      })
      .returning();

    const product = createdProduct[0];

    if (!product) return createdProduct;

    await upsertPrimaryPrice(tx, {
      productId: product.id,
      referenceCode: product.productCode,
      priceCopR1,
      priceCopR2,
      priceCopR3,
      priceViomar,
      priceColanta,
      priceMayorista,
      priceUSD,
      startDate,
      endDate,
      isActive,
    });

    return createdProduct;
  });

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

  const {
    id,
    name,
    description,
    categoryId,
    priceCopR1,
    priceCopR2,
    priceCopR3,
    priceViomar,
    priceColanta,
    priceMayorista,
    priceUSD,
    startDate,
    endDate,
    isActive,
  } = await request.json();

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

  const hasPricePayload =
    priceCopR1 !== undefined ||
    priceCopR2 !== undefined ||
    priceCopR3 !== undefined ||
    priceViomar !== undefined ||
    priceColanta !== undefined ||
    priceMayorista !== undefined ||
    priceUSD !== undefined ||
    startDate !== undefined ||
    endDate !== undefined ||
    isActive !== undefined;

  const updated = await db.transaction(async (tx) => {
    const updatedProduct = await tx
      .update(products)
      .set(patch)
      .where(eq(products.id, String(id)))
      .returning();

    const product = updatedProduct[0];

    if (product && hasPricePayload) {
      await upsertPrimaryPrice(tx, {
        productId: product.id,
        referenceCode: product.productCode,
        priceCopR1,
        priceCopR2,
        priceCopR3,
        priceViomar,
        priceColanta,
        priceMayorista,
        priceUSD,
        startDate,
        endDate,
        isActive: product.isActive,
      });
    }

    return updatedProduct;
  });

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
