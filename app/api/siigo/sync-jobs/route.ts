import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { siigoSyncJobs } from "@/src/db/erp/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

const ACCOUNTING_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_FINANCIERA",
  "AUXILIAR_CONTABLE",
  "TESORERIA_Y_CARTERA",
]);

function isAccountingRole(role: string | null) {
  return Boolean(role && ACCOUNTING_ROLES.has(role));
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "siigo:sync-jobs:get",
    limit: 100,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGO");

  if (forbidden) return forbidden;

  const role = getRoleFromRequest(request);

  if (!isAccountingRole(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(siigoSyncJobs);

  const total = Number(countRow?.total ?? 0);

  const items = await db
    .select({
      id: siigoSyncJobs.id,
      jobType: siigoSyncJobs.jobType,
      status: siigoSyncJobs.status,
      bankId: siigoSyncJobs.bankId,
      requestedBy: siigoSyncJobs.requestedBy,
      payload: siigoSyncJobs.payload,
      result: siigoSyncJobs.result,
      startedAt: siigoSyncJobs.startedAt,
      finishedAt: siigoSyncJobs.finishedAt,
      createdAt: siigoSyncJobs.createdAt,
      updatedAt: siigoSyncJobs.updatedAt,
    })
    .from(siigoSyncJobs)
    .orderBy(desc(siigoSyncJobs.createdAt))
    .limit(pageSize)
    .offset(offset);

  return Response.json({
    items,
    page,
    pageSize,
    total,
    hasNextPage: offset + items.length < total,
  });
}
