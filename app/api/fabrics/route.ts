import { and, eq, ilike } from "drizzle-orm";

import { db } from "@/src/db";
import { fabrics } from "@/src/db/erp/schema";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { fabricsQuerySchema } from "@/src/utils/molding-fabrics-contract";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "fabrics:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MOLDERIA");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const parsed = fabricsQuerySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    activeOnly: searchParams.get("activeOnly") ?? undefined,
  });

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Parámetros de telas inválidos.");
  }

  const { search, category, activeOnly } = parsed.data;

  const where = and(
    activeOnly ? eq(fabrics.isActive, true) : undefined,
    search ? ilike(fabrics.name, `%${search}%`) : undefined,
    category ? eq(fabrics.category, category) : undefined,
  );

  try {
    const items = await db
      .select({
        id: fabrics.id,
        name: fabrics.name,
        category: fabrics.category,
        isActive: fabrics.isActive,
        createdAt: fabrics.createdAt,
        updatedAt: fabrics.updatedAt,
      })
      .from(fabrics)
      .where(where)
      .orderBy(fabrics.name);

    return Response.json({ items });
  } catch (error) {
    const dbError = dbErrorResponse(error);

    if (dbError) {
      return jsonError(
        dbError.status,
        "DATABASE_ERROR",
        "No se pudo consultar el catálogo de telas.",
      );
    }

    return jsonError(
      500,
      "FABRICS_FETCH_FAILED",
      "No se pudo consultar el catálogo de telas.",
    );
  }
}
