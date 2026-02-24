import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { products } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "products:valid-prices:get",
    limit: 250,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const productId = String(id ?? "").trim();

  if (!productId) return new Response("id required", { status: 400 });

  try {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) return new Response("Product not found", { status: 404 });

    const item = {
      id: product.id,
      catalogType: null,
      referenceCode: product.productCode ?? product.id,
      priceCopInternational: product.priceCopInternational ?? null,
      priceCopR1: product.priceCopR1 ?? null,
      priceCopR2: product.priceCopR2 ?? null,
      priceCopR3: product.priceCopR3 ?? null,
      priceViomar: product.priceViomar ?? null,
      priceColanta: product.priceColanta ?? null,
      priceMayorista: product.priceMayorista ?? null,
      priceUSD: product.priceUSD ?? null,
      isEditable: null,
      startDate: null,
      endDate: null,
      isActive: product.isActive ?? true,
    };

    return Response.json({ items: [item] });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar precios", { status: 500 });
  }
}
