import { and, eq, ilike, isNotNull, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { additions, categories } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function normalizeAdditionCodePrefix(categoryName: string) {
  const cleaned = String(categoryName)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return cleaned.slice(0, 3).padEnd(3, "X");
}

async function buildNextAdditionCode(categoryId: string) {
  const [category] = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!category) {
    return new Response("Categoría inválida", { status: 400 });
  }

  const prefix = normalizeAdditionCodePrefix(category.name);

  const [row] = await db
    .select({
      maxSuffix: sql<number>`max(nullif(substring(${additions.additionCode}, 4, 2), '')::int)`,
    })
    .from(additions)
    .where(sql`${additions.additionCode} like ${prefix + "%"}`);

  const nextSuffix = (row?.maxSuffix ?? 0) + 1;

  if (nextSuffix > 99) {
    return new Response(
      "Se alcanzó el máximo de códigos para esta categoría",
      { status: 409 },
    );
  }

  return `${prefix}${String(nextSuffix).padStart(2, "0")}`;
}

function normalizeCatalogType(value: unknown): "NACIONAL" | "INTERNACIONAL" {
  return String(value ?? "NACIONAL").toUpperCase() === "INTERNACIONAL"
    ? "INTERNACIONAL"
    : "NACIONAL";
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "additions:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const catalogType = String(searchParams.get("catalogType") ?? "").trim().toUpperCase();
    const status = String(searchParams.get("status") ?? "all").trim().toLowerCase();
    const categoryId = String(searchParams.get("categoryId") ?? "").trim();
    const q = String(searchParams.get("q") ?? "").trim();

    const filters: any[] = [];

    if (catalogType === "INTERNACIONAL") {
      filters.push(
        and(
          isNotNull(additions.priceUSD),
          isNotNull(additions.priceCopInternational),
        ),
      );
    }

    if (status === "active") {
      filters.push(eq(additions.isActive, true));
    } else if (status === "inactive") {
      filters.push(eq(additions.isActive, false));
    }

    if (categoryId) {
      filters.push(eq(additions.categoryId, categoryId));
    }

    if (q) {
      filters.push(
        sql`(${ilike(additions.additionCode, `%${q}%`)} OR ${ilike(additions.name, `%${q}%`)})`,
      );
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(additions)
      .where(where);

    const items = await db
      .select()
      .from(additions)
      .where(where)
      .limit(pageSize)
      .offset(offset);
    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar adiciones", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "additions:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const {
    catalogType,
    productKind,
    name,
    description,
    categoryId,
    priceCopBase,
    priceCopInternational,
    priceUSD,
    trmUsed,
    startDate,
    isActive,
  } = await request.json();

  const n = String(name ?? "").trim();

  if (!n) {
    return new Response("name required", { status: 400 });
  }

  const categoryIdValue = String(categoryId ?? "").trim();
  const catalogTypeValue = normalizeCatalogType(catalogType);
  const productKindValue =
    String(productKind ?? "REGULAR").toUpperCase() === "ESPECIAL"
      ? "ESPECIAL"
      : "REGULAR";

  if (!categoryIdValue) {
    return new Response("categoryId required", { status: 400 });
  }

  const additionCode = await buildNextAdditionCode(categoryIdValue);

  if (additionCode instanceof Response) return additionCode;

  try {
    const created = await db
      .insert(additions)
      .values({
        additionCode,
        name: n,
        description: description ? String(description) : null,
        categoryId: categoryIdValue,
        catalogType: catalogTypeValue,
        productKind: productKindValue,
        priceCopBase: priceCopBase ? String(priceCopBase) : null,
        priceCopInternational: priceCopInternational
          ? String(priceCopInternational)
          : null,
        priceUSD: priceUSD ? String(priceUSD) : null,
        trmUsed: trmUsed ? String(trmUsed) : null,
        startDate: startDate ? new Date(String(startDate)) : null,
        endDate: null,
        isActive: isActive ?? true,
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo crear la adición", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "additions:put",
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
    catalogType,
    productKind,
    priceCopBase,
    priceCopInternational,
    priceUSD,
    trmUsed,
    startDate,
    isActive,
  } = await request.json();

  if (!id) {
    return new Response("Addition ID required", { status: 400 });
  }

  const [existing] = await db
    .select({
      categoryId: additions.categoryId,
      additionCode: additions.additionCode,
    })
    .from(additions)
    .where(eq(additions.id, String(id)))
    .limit(1);

  if (!existing) {
    return new Response("Addition not found", { status: 404 });
  }

  const patch: Partial<typeof additions.$inferInsert> = {
    isActive,
    updatedAt: new Date(),
  };

  if (name !== undefined) patch.name = String(name).trim();
  if (description !== undefined)
    patch.description = description ? String(description) : null;
  if (catalogType !== undefined)
    patch.catalogType = normalizeCatalogType(catalogType);
  if (productKind !== undefined) {
    patch.productKind =
      String(productKind).toUpperCase() === "ESPECIAL"
        ? "ESPECIAL"
        : "REGULAR";
  }
  if (priceCopBase !== undefined)
    patch.priceCopBase = priceCopBase ? String(priceCopBase) : null;
  if (priceCopInternational !== undefined)
    patch.priceCopInternational = priceCopInternational
      ? String(priceCopInternational)
      : null;
  if (priceUSD !== undefined) patch.priceUSD = priceUSD ? String(priceUSD) : null;
  if (trmUsed !== undefined) patch.trmUsed = trmUsed ? String(trmUsed) : null;
  if (startDate !== undefined)
    patch.startDate = startDate ? new Date(String(startDate)) : null;

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
    !existing.additionCode ||
    (categoryIdValue && categoryIdValue !== existing.categoryId);

  if (shouldRegenerateCode) {
    const additionCode = await buildNextAdditionCode(nextCategoryId);

    if (additionCode instanceof Response) return additionCode;

    patch.additionCode = additionCode;
  }

  try {
    const updated = await db
      .update(additions)
      .set(patch)
      .where(eq(additions.id, String(id)))
      .returning();

    return Response.json(updated);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo editar la adición", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "additions:delete",
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
    return new Response("Addition ID required", { status: 400 });
  }

  try {
    const deleted = await db
      .delete(additions)
      .where(eq(additions.id, String(id)))
      .returning();

    return Response.json(deleted);
  } catch (error) {
    return new Response(
      "No se pudo eliminar. Verifica si la adición tiene órdenes asociadas.",
      { status: 409 },
    );
  }
}
