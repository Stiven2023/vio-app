import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  purchaseRequirementLines,
  purchaseRequirements,
} from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "purchase-requirements:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const orderId = String(searchParams.get("orderId") ?? "").trim();
    const orderItemId = String(searchParams.get("orderItemId") ?? "").trim();
    const status = String(searchParams.get("status") ?? "").trim().toUpperCase();
    const q = String(searchParams.get("q") ?? "").trim();

    const conditions = [
      orderId ? eq(purchaseRequirements.orderId, orderId) : null,
      orderItemId ? eq(purchaseRequirements.orderItemId, orderItemId) : null,
      status ? eq(purchaseRequirements.status, status) : null,
      q ? ilike(purchaseRequirements.status, `%${q}%`) : null,
    ].filter(Boolean) as any[];

    const whereClause =
      conditions.length > 0
        ? conditions.reduce((acc, condition) => (acc ? and(acc, condition) : condition), null as any)
        : undefined;

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(purchaseRequirements)
      .where(whereClause as any);

    const total = Number(countRow?.total ?? 0);

    const rows = await db
      .select({
        id: purchaseRequirements.id,
        orderId: purchaseRequirements.orderId,
        orderItemId: purchaseRequirements.orderItemId,
        status: purchaseRequirements.status,
        hintsSnapshot: purchaseRequirements.hintsSnapshot,
        createdBy: purchaseRequirements.createdBy,
        approvedBy: purchaseRequirements.approvedBy,
        approvedAt: purchaseRequirements.approvedAt,
        createdAt: purchaseRequirements.createdAt,
        updatedAt: purchaseRequirements.updatedAt,
      })
      .from(purchaseRequirements)
      .where(whereClause as any)
      .orderBy(desc(purchaseRequirements.createdAt))
      .limit(pageSize)
      .offset(offset);

    const requirementIds = rows.map((row) => row.id);

    const lineRows =
      requirementIds.length > 0
        ? await db
            .select({
              id: purchaseRequirementLines.id,
              purchaseRequirementId: purchaseRequirementLines.purchaseRequirementId,
              category: purchaseRequirementLines.category,
              description: purchaseRequirementLines.description,
              qtyPlanned: purchaseRequirementLines.qtyPlanned,
              unit: purchaseRequirementLines.unit,
              qtyOrdered: purchaseRequirementLines.qtyOrdered,
              qtyReceived: purchaseRequirementLines.qtyReceived,
              coverageStatus: purchaseRequirementLines.coverageStatus,
              inventoryItemId: purchaseRequirementLines.inventoryItemId,
              createdAt: purchaseRequirementLines.createdAt,
              updatedAt: purchaseRequirementLines.updatedAt,
            })
            .from(purchaseRequirementLines)
            .where(
              inArray(purchaseRequirementLines.purchaseRequirementId, requirementIds),
            )
        : [];

    const grouped = new Map<string, typeof lineRows>();

    for (const line of lineRows) {
      const key = String(line.purchaseRequirementId);
      const bucket = grouped.get(key) ?? [];

      bucket.push(line);
      grouped.set(key, bucket);
    }

    return Response.json({
      items: rows.map((row) => ({
        ...row,
        lines: grouped.get(String(row.id)) ?? [],
      })),
      page,
      pageSize,
      total,
      hasNextPage: offset + rows.length < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar requerimientos", { status: 500 });
  }
}
