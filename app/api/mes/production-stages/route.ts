/**
 * GET   /api/mes/production-stages?orderId=<uuid>&orderItemId=<uuid>&area=SUBLIMACION
 * POST  /api/mes/production-stages
 */
import { and, desc, eq, sql } from "drizzle-orm";

import { mesDb } from "@/src/db";
import { mesProductionStages } from "@/src/db/mes/schema";
import {
  dbJsonError,
  jsonError,
  jsonForbidden,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import {
  mesProductionStageCreateSchema,
  toValidDate,
} from "@/src/utils/mes-workflow";
import { parsePaginationStrict } from "@/src/utils/pagination";

function toStr(v: unknown) {
  return String(v ?? "").trim() || null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:production-stages:get",
    limit: 300,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MES");
  if (forbidden) return jsonForbidden();

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePaginationStrict(searchParams, {
    defaultPageSize: 50,
    maxPageSize: 200,
  });
  const orderId = String(searchParams.get("orderId") ?? "").trim();
  const orderItemId = String(searchParams.get("orderItemId") ?? "").trim();
  const area = String(searchParams.get("area") ?? "").trim();

  const conditions = [];
  if (orderId) conditions.push(eq(mesProductionStages.orderId, orderId));
  if (orderItemId) conditions.push(eq(mesProductionStages.orderItemId, orderItemId));
  if (area) conditions.push(eq(mesProductionStages.area, area as any));

  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await mesDb
    .select({ total: sql<number>`count(*)::int` })
    .from(mesProductionStages)
    .where(where);

  const rows = await mesDb
    .select()
    .from(mesProductionStages)
    .where(where)
    .orderBy(desc(mesProductionStages.createdAt))
    .limit(pageSize)
    .offset(offset);

  return Response.json({
    ok: true,
    data: rows,
    meta: { page, pageSize, total },
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:production-stages:post",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "GESTIONAR_MES");
  if (forbidden) return jsonForbidden();

  const body = await request.json().catch(() => null);
  const parsed = mesProductionStageCreateSchema.safeParse(body);
  if (!parsed.success) return zodFirstErrorEnvelope(parsed.error);

  const data = parsed.data;

  const insertResult = await mesDb
    .insert(mesProductionStages)
    .values({
      orderId: data.orderId,
      orderItemId: data.orderItemId,
      area: data.area as any,
      stageName: toStr(data.stageName),
      startedAt: toValidDate(data.startedAt) ?? undefined,
      endedAt: toValidDate(data.endedAt) ?? undefined,
      operatorId: toStr(data.operatorId) ?? undefined,
      operatorName: toStr(data.operatorName),
      machineId: toStr(data.machineId),
      machineName: toStr(data.machineName),
      quantityProcessed: data.quantityProcessed ?? 0,
      notes: toStr(data.notes),
    })
    .returning()
    .catch((e) => dbJsonError(e, "No se pudo registrar la etapa de producción."));

  if (insertResult instanceof Response) return insertResult;
  const created = insertResult?.[0];
  if (!created) return jsonError(500, "INTERNAL", "Error al registrar la etapa.", {});

  return Response.json({ ok: true, data: created }, { status: 201 });
}
