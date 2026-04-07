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
  tipo: z.enum(["bg", "pyg", "flujo", "completo"]).default("completo"),
});

type BGRow = {
  account_code: string;
  account_name: string;
  seccion_bg: "ACTIVO" | "PASIVO" | "PATRIMONIO";
  clasificacion_niif: string;
  saldo: number | string;
};

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);

  return Number.isFinite(n) ? n : 0;
}

function agruparBalanceGeneral(rows: BGRow[]) {
  const secciones: Record<string, { total: number; cuentas: BGRow[] }> = {};

  for (const row of rows) {
    const key = `${row.seccion_bg}::${row.clasificacion_niif}`;

    if (!secciones[key]) {
      secciones[key] = { total: 0, cuentas: [] };
    }

    secciones[key].cuentas.push(row);
    secciones[key].total += asNumber(row.saldo);
  }

  const totalActivos = rows
    .filter((row) => row.seccion_bg === "ACTIVO")
    .reduce((sum, row) => sum + asNumber(row.saldo), 0);
  const totalPasivos = rows
    .filter((row) => row.seccion_bg === "PASIVO")
    .reduce((sum, row) => sum + asNumber(row.saldo), 0);
  const totalPatrimonio = rows
    .filter((row) => row.seccion_bg === "PATRIMONIO")
    .reduce((sum, row) => sum + asNumber(row.saldo), 0);

  return {
    secciones,
    totales: {
      activos: totalActivos,
      pasivos: totalPasivos,
      patrimonio: totalPatrimonio,
      cuadre: Math.abs(totalActivos - (totalPasivos + totalPatrimonio)) < 0.01,
      diferencia: totalActivos - (totalPasivos + totalPatrimonio),
    },
  };
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:estados-financieros:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_ESTADO_RESULTADOS");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    period: String(searchParams.get("period") ?? "").trim(),
    tipo: String(searchParams.get("tipo") ?? "completo")
      .trim()
      .toLowerCase(),
  });

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Parámetros inválidos para estados financieros.",
    );
  }

  const { period, tipo } = parsed.data;

  try {
    if (tipo === "completo") {
      const rows = await db.execute(
        sql`SELECT fn_estados_financieros(${period}) AS payload`,
      );
      const payload =
        (rows.rows?.[0] as { payload?: unknown } | undefined)?.payload ?? null;

      return Response.json({ ok: true, data: payload, period });
    }

    if (tipo === "bg") {
      const rows = await db.execute(sql`
        SELECT
          account_code,
          account_name,
          seccion_bg,
          clasificacion_niif,
          saldo_abs AS saldo
        FROM v_balance_general
        WHERE period = ${period}
          AND saldo_abs > 0
        ORDER BY account_code
      `);

      return Response.json({
        ok: true,
        data: agruparBalanceGeneral((rows.rows ?? []) as BGRow[]),
        period,
      });
    }

    if (tipo === "pyg") {
      const rows = await db.execute(sql`
        SELECT
          account_code,
          account_name,
          seccion_pyg,
          linea_pyg,
          ABS(saldo) AS saldo,
          contribucion_utilidad
        FROM v_estado_resultados
        WHERE period = ${period}
        ORDER BY account_code
      `);

      const utilidadNeta = (rows.rows ?? []).reduce(
        (sum, row: any) => sum + asNumber(row.contribucion_utilidad),
        0,
      );

      return Response.json({
        ok: true,
        data: rows.rows ?? [],
        utilidadNeta,
        period,
      });
    }

    const rows = await db.execute(sql`
      SELECT *
      FROM v_flujo_efectivo
      WHERE period = ${period}
    `);

    return Response.json({
      ok: true,
      data: (rows.rows?.[0] as Record<string, unknown> | undefined) ?? null,
      period,
    });
  } catch (error) {
    const dbError = dbJsonError(
      error,
      "No se pudo consultar estados financieros.",
    );

    if (dbError) return dbError;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo consultar estados financieros.",
    );
  }
}
