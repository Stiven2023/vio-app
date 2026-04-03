/**
 * GET    /api/mes/production-stages/[id]
 * PATCH  /api/mes/production-stages/[id]
 */
import { eq } from "drizzle-orm";

import { mesDb } from "@/src/db";
import { mesProductionStages } from "@/src/db/mes/schema";
import {
  dbJsonError,
  jsonForbidden,
  jsonNotFound,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { mesProductionStageUpdateSchema, toValidDate } from "@/src/utils/mes-workflow";

function toStr(v: unknown) {
  return String(v ?? "").trim() || null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "mes:production-stage:get",
    limit: 300,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MES");
  if (forbidden) return jsonForbidden();

  const { id } = await params;

  const [row] = await mesDb
    .select()
    .from(mesProductionStages)
    .where(eq(mesProductionStages.id, id))
    .limit(1);

  if (!row) return jsonNotFound("Etapa de producción no encontrada.");

  return Response.json({ ok: true, data: row });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "mes:production-stage:patch",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "GESTIONAR_MES");
  if (forbidden) return jsonForbidden();

  const { id } = await params;

  const [existing] = await mesDb
    .select({ id: mesProductionStages.id })
    .from(mesProductionStages)
    .where(eq(mesProductionStages.id, id))
    .limit(1);

  if (!existing) return jsonNotFound("Etapa de producción no encontrada.");

  const body = await request.json().catch(() => null);
  const parsed = mesProductionStageUpdateSchema.safeParse(body);
  if (!parsed.success) return zodFirstErrorEnvelope(parsed.error);

  const data = parsed.data;

  const updateResult = await mesDb
    .update(mesProductionStages)
    .set({
      endedAt: toValidDate(data.endedAt) ?? undefined,
      operatorName: toStr(data.operatorName),
      machineId: toStr(data.machineId),
      machineName: toStr(data.machineName),
      ...(data.quantityProcessed !== undefined
        ? { quantityProcessed: data.quantityProcessed }
        : {}),
      notes: toStr(data.notes),
      updatedAt: new Date(),
    })
    .where(eq(mesProductionStages.id, id))
    .returning()
    .catch((e) => dbJsonError(e, "No se pudo actualizar la etapa de producción."));

  if (updateResult instanceof Response) return updateResult;
  const updated = updateResult?.[0];

  return Response.json({ ok: true, data: updated });
}
