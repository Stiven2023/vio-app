import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { accountingPeriods } from "@/src/db/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { accountingPeriodSchema } from "@/src/utils/accounting-period";

// ── GET /api/contabilidad/periodos ────────────────────────────────────────────

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:periodos:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CONTABILIDAD");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  const rows = await db
    .select({
      id: accountingPeriods.id,
      period: accountingPeriods.period,
      status: accountingPeriods.status,
      openedAt: accountingPeriods.openedAt,
      closedAt: accountingPeriods.closedAt,
      closeReason: accountingPeriods.closeReason,
      createdAt: accountingPeriods.createdAt,
    })
    .from(accountingPeriods)
    .where(
      statusFilter === "OPEN" || statusFilter === "CLOSED"
        ? eq(accountingPeriods.status, statusFilter)
        : undefined,
    )
    .orderBy(desc(accountingPeriods.period));

  return Response.json({ ok: true, periods: rows });
}

// ── POST /api/contabilidad/periodos ───────────────────────────────────────────

const openPeriodSchema = z.object({
  period: accountingPeriodSchema,
});

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:periodos:post",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_CONTABILIDAD");

  if (forbidden) return forbidden;

  const employeeId = getEmployeeIdFromRequest(request);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      400,
      "INVALID_JSON",
      "El cuerpo de la solicitud debe ser JSON válido.",
    );
  }

  const parsed = openPeriodSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Período contable inválido.");
  }

  const { period } = parsed.data;

  // Check if already exists
  const [existing] = await db
    .select({ id: accountingPeriods.id, status: accountingPeriods.status })
    .from(accountingPeriods)
    .where(eq(accountingPeriods.period, period))
    .limit(1);

  if (existing?.id) {
    return jsonError(
      409,
      "PERIOD_ALREADY_EXISTS",
      `El período ${period} ya existe con estado ${existing.status}.`,
      { period: [`El período ${period} ya fue registrado.`] },
    );
  }

  const [created] = await db
    .insert(accountingPeriods)
    .values({
      period,
      status: "OPEN",
      openedBy: employeeId,
    })
    .returning({
      id: accountingPeriods.id,
      period: accountingPeriods.period,
      status: accountingPeriods.status,
      openedAt: accountingPeriods.openedAt,
    });

  return Response.json({ ok: true, period: created }, { status: 201 });
}
