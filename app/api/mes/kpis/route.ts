import { sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const querySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:kpis:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MES");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    period: String(searchParams.get("period") ?? "").trim(),
  });

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Período inválido para consultar KPIs MES.",
    );
  }

  const { period } = parsed.data;

  try {
    const [otif, throughput, reposiciones] = await Promise.all([
      db.execute(sql`SELECT * FROM v_mes_otif WHERE period = ${period}`),
      db.execute(sql`
        SELECT
          fecha,
          SUM(producido) AS total_producido,
          SUM(planificado) AS total_planificado
        FROM v_mes_throughput_diario
        WHERE TO_CHAR(fecha, 'YYYY-MM') = ${period}
        GROUP BY fecha
        ORDER BY fecha
      `),
      db.execute(sql`
        SELECT
          COUNT(*) AS total_repos,
          COALESCE(SUM(costo_estimado_reposicion), 0) AS costo_total
        FROM v_mes_reposiciones
        WHERE period = ${period}
      `),
    ]);

    return Response.json({
      ok: true,
      data: {
        period,
        otif: otif.rows ?? [],
        throughput: throughput.rows ?? [],
        reposiciones: (reposiciones.rows?.[0] as
          | Record<string, unknown>
          | undefined) ?? {
          total_repos: 0,
          costo_total: 0,
        },
      },
    });
  } catch (error) {
    const dbError = dbJsonError(
      error,
      "No se pudieron consultar los KPIs MES.",
    );

    if (dbError) return dbError;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudieron consultar los KPIs MES.",
    );
  }
}
