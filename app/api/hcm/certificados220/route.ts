import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { certificados220 } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import { hcmCertificados220QuerySchema } from "@/src/utils/hcm-contract";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:certificados220:get",
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
  const query = hcmCertificados220QuerySchema.safeParse({
    vigenciaFiscal: searchParams.get("vigenciaFiscal") ?? undefined,
  });

  if (!query.success) {
    return zodFirstErrorEnvelope(
      query.error,
      "Parámetros de certificados 220 inválidos.",
    );
  }

  const { page, pageSize, offset } = parsePagination(searchParams);
  const clauses = [eq(certificados220.employeeId, employeeId)];

  if (query.data.vigenciaFiscal) {
    clauses.push(eq(certificados220.vigenciaFiscal, query.data.vigenciaFiscal));
  }

  const where = and(...clauses);

  try {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(certificados220)
      .where(where);

    const total = countRow?.count ?? 0;

    const items = await db
      .select({
        id: certificados220.id,
        vigenciaFiscal: certificados220.vigenciaFiscal,
        totalIngresos: certificados220.totalIngresos,
        totalRetenciones: certificados220.totalRetenciones,
        aportesSalud: certificados220.aportesSalud,
        aportesPension: certificados220.aportesPension,
        status: certificados220.status,
        pdfUrl: certificados220.pdfUrl,
        firmadoEn: certificados220.firmadoEn,
        createdAt: certificados220.createdAt,
      })
      .from(certificados220)
      .where(where)
      .orderBy(
        desc(certificados220.vigenciaFiscal),
        desc(certificados220.createdAt),
      )
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
      "No se pudieron consultar los certificados 220.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudieron consultar los certificados 220.",
    );
  }
}
