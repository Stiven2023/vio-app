import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { productPrices } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function isValidNow(row: {
  isActive: boolean | null;
  startDate: Date | null;
  endDate: Date | null;
}) {
  if (row.isActive === false) return false;

  const now = new Date();
  if (row.startDate && now < row.startDate) return false;
  if (row.endDate && now > row.endDate) return false;

  return true;
}

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
    const items = await db
      .select()
      .from(productPrices)
      .where(and(eq(productPrices.productId, productId)));

    const valid = items.filter((x) =>
      isValidNow({
        isActive: (x as any).isActive ?? true,
        startDate: (x as any).startDate ?? null,
        endDate: (x as any).endDate ?? null,
      }),
    );

    return Response.json({ items: valid });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar precios", { status: 500 });
  }
}
