import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { warehouseStock } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { resolveWarehouseIdByLocation } from "@/src/utils/inventory-sync";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

function toLocation(v: unknown): "BODEGA_PRINCIPAL" | "TIENDA" | null {
  const location = String(v ?? "BODEGA_PRINCIPAL").trim().toUpperCase();

  return location === "BODEGA_PRINCIPAL" || location === "TIENDA"
    ? (location as "BODEGA_PRINCIPAL" | "TIENDA")
    : null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-stock:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const variantId = String(searchParams.get("variantId") ?? "").trim();
    const warehouseIdParam = String(searchParams.get("warehouseId") ?? "").trim();
    const location = toLocation(searchParams.get("location"));

    if (!variantId) {
      return new Response("variantId required", { status: 400 });
    }

    const warehouseId = warehouseIdParam
      ? warehouseIdParam
      : location
        ? await resolveWarehouseIdByLocation(db, location)
        : null;

    if (!warehouseId) {
      return new Response("warehouse invalid", { status: 400 });
    }

    const [row] = await db
      .select({ stock: warehouseStock.availableQty })
      .from(warehouseStock)
      .where(
        and(
          eq(warehouseStock.variantId, variantId),
          eq(warehouseStock.warehouseId, warehouseId),
        ),
      )
      .limit(1);

    const stock = asNumber(row?.stock);

    return Response.json({
      variantId,
      warehouseId,
      location,
      stock,
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar stock", { status: 500 });
  }
}
