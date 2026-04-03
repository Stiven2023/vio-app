import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { accountingEntries, accountingPeriods } from "@/src/db/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

// ── PUT /api/contabilidad/periodos/[period]/close ─────────────────────────────

const closePeriodBodySchema = z.object({
  closeReason: z.string().min(5).max(500).optional(),
});

export async function PUT(
  request: Request,
  props: { params: Promise<{ period: string }> },
) {
  const limited = rateLimit(request, {
    key: "contabilidad:periodos:close",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_CONTABILIDAD");

  if (forbidden) return forbidden;

  const { period: rawPeriod } = await props.params;
  const period = String(rawPeriod ?? "").trim();

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return jsonError(
      400,
      "INVALID_PERIOD",
      "El período debe tener el formato YYYY-MM.",
      { period: ["Formato inválido. Use YYYY-MM, ej. 2026-04."] },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = closePeriodBodySchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Datos de cierre inválidos.");
  }

  const { closeReason } = parsed.data;
  const employeeId = getEmployeeIdFromRequest(request);

  // Load period
  const [existing] = await db
    .select({ id: accountingPeriods.id, status: accountingPeriods.status })
    .from(accountingPeriods)
    .where(eq(accountingPeriods.period, period))
    .limit(1);

  if (!existing?.id) {
    return jsonError(
      404,
      "PERIOD_NOT_FOUND",
      `El período ${period} no existe.`,
    );
  }

  if (existing.status === "CLOSED") {
    return jsonError(
      409,
      "PERIOD_ALREADY_CLOSED",
      `El período ${period} ya está cerrado.`,
    );
  }

  // Guard: no DRAFT entries allowed before closing
  const [draftCount] = await db
    .select({ total: count() })
    .from(accountingEntries)
    .where(
      and(
        eq(accountingEntries.period, period),
        eq(accountingEntries.status, "DRAFT"),
      ),
    );

  const drafts = Number(draftCount?.total ?? 0);

  if (drafts > 0) {
    return jsonError(
      422,
      "PERIOD_HAS_DRAFT_ENTRIES",
      `El período ${period} tiene ${drafts} asiento(s) en borrador. Aprueba o elimínalos antes de cerrar.`,
      {
        period: [
          `Hay ${drafts} asiento(s) en borrador pendientes de resolución.`,
        ],
      },
    );
  }

  const [updated] = await db
    .update(accountingPeriods)
    .set({
      status: "CLOSED",
      closedAt: new Date(),
      closedBy: employeeId,
      closeReason: closeReason ?? null,
    })
    .where(eq(accountingPeriods.id, existing.id))
    .returning({
      id: accountingPeriods.id,
      period: accountingPeriods.period,
      status: accountingPeriods.status,
      closedAt: accountingPeriods.closedAt,
    });

  return Response.json({ ok: true, period: updated });
}
