import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { colillasPago } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import { hcmColillasQuerySchema } from "@/src/utils/hcm-contract";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:colillas:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const employeeId = await resolveEmployeeIdFromRequest(request);

  if (!employeeId) {
    return jsonError(
      401,
      "UNAUTHORIZED",
      "No autenticado o sin perfil de empleado.",
    );
  }

  const { searchParams } = new URL(request.url);
  const query = hcmColillasQuerySchema.safeParse({
    period: searchParams.get("period") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  if (!query.success) {
    return zodFirstErrorEnvelope(
      query.error,
      "Parámetros de colillas inválidos.",
    );
  }

  const { page, pageSize, offset } = parsePagination(searchParams);
  const clauses = [eq(colillasPago.employeeId, employeeId)];

  if (query.data.period)
    clauses.push(eq(colillasPago.period, query.data.period));
  if (query.data.status)
    clauses.push(eq(colillasPago.status, query.data.status));

  const where = and(...clauses);

  try {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(colillasPago)
      .where(where);

    const total = countRow?.count ?? 0;

    const items = await db
      .select({
        id: colillasPago.id,
        period: colillasPago.period,
        status: colillasPago.status,
        totalDevengado: colillasPago.totalDevengado,
        totalDeducciones: colillasPago.totalDeducciones,
        netoAPagar: colillasPago.netoAPagar,
        pdfUrl: colillasPago.pdfUrl,
        accountingEntryId: colillasPago.accountingEntryId,
        pagadoEn: colillasPago.pagadoEn,
        createdAt: colillasPago.createdAt,
        updatedAt: colillasPago.updatedAt,
      })
      .from(colillasPago)
      .where(where)
      .orderBy(desc(colillasPago.period), desc(colillasPago.createdAt))
      .limit(pageSize)
      .offset(offset);

    return Response.json({
      items,
      page,
      pageSize,
      total,
      hasNextPage: offset + items.length < total,
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudieron consultar las colillas.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudieron consultar las colillas.",
    );
  }
}
