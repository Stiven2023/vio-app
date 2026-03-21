import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { categories, products } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function escapeCsvCell(val: string | null | undefined): string {
  const str = String(val ?? "");
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "products:export:get",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const rows = await db
      .select({
        productCode: products.productCode,
        categoryName: categories.name,
        name: products.name,
        description: products.description,
        priceCopBase: products.priceCopBase,
        priceCopR1: products.priceCopR1,
        priceCopR2: products.priceCopR2,
        priceCopR3: products.priceCopR3,
        priceMayorista: products.priceMayorista,
        priceColanta: products.priceColanta,
        isActive: products.isActive,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(products.productCode);

    const headers = [
      "productCode",
      "categoryName",
      "name",
      "description",
      "priceCopBase",
      "priceCopR1",
      "priceCopR2",
      "priceCopR3",
      "priceMayorista",
      "priceColanta",
      "isActive",
    ].join(";");

    const dataLines = rows.map((row) =>
      [
        escapeCsvCell(row.productCode),
        escapeCsvCell(row.categoryName),
        escapeCsvCell(row.name),
        escapeCsvCell(row.description),
        escapeCsvCell(row.priceCopBase),
        escapeCsvCell(row.priceCopR1),
        escapeCsvCell(row.priceCopR2),
        escapeCsvCell(row.priceCopR3),
        escapeCsvCell(row.priceMayorista),
        escapeCsvCell(row.priceColanta),
        row.isActive ? "SI" : "NO",
      ].join(";")
    );

    const csv = [headers, ...dataLines].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=products-export.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo exportar productos", { status: 500 });
  }
}
