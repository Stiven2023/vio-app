/**
 * GET    /api/mes/reposiciones?orderId=<uuid>&status=ABIERTA&requestingProcess=MONTAJE&causeCode=FALTANTE
 * POST   /api/mes/reposiciones
 *
 * El filtro requestingProcess permite que cada área vea su historial de reposiciones.
 * Ejemplos: ?requestingProcess=MONTAJE&status=ABIERTA
 *           ?requestingProcess=SUBLIMACION
 *           ?requestingProcess=CONFECCION&causeCode=DAÑO
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { mesDb } from "@/src/db";
import { mesReposiciones } from "@/src/db/mes/schema";
import {
  dbJsonError,
  jsonError,
  jsonForbidden,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import {
  generateRepositionCode,
  mesReposicionCreateSchema,
} from "@/src/utils/mes-workflow";
import { parsePaginationStrict } from "@/src/utils/pagination";

function toStr(v: unknown) {
  return String(v ?? "").trim() || null;
}

function toProcess(v: unknown) {
  return String(v ?? "").trim().toUpperCase() || null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:reposiciones:get",
    limit: 300,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MES");
  if (forbidden) return jsonForbidden();

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePaginationStrict(searchParams, {
    defaultPageSize: 30,
    maxPageSize: 100,
  });
  const orderId = String(searchParams.get("orderId") ?? "").trim();
  const status = String(searchParams.get("status") ?? "").trim();
  const requestingProcess = toProcess(searchParams.get("requestingProcess"));
  const causeCode = String(searchParams.get("causeCode") ?? "").trim();

  const conditions = [];
  if (orderId) conditions.push(eq(mesReposiciones.orderId, orderId));
  if (status) conditions.push(eq(mesReposiciones.status, status as any));
  if (requestingProcess) conditions.push(eq(mesReposiciones.requestingProcess, requestingProcess));
  if (causeCode) conditions.push(eq(mesReposiciones.causeCode, causeCode as any));

  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await mesDb
    .select({ total: sql<number>`count(*)::int` })
    .from(mesReposiciones)
    .where(where);

  const rows = await mesDb
    .select()
    .from(mesReposiciones)
    .where(where)
    .orderBy(desc(mesReposiciones.createdAt))
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
    key: "mes:reposiciones:post",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "GESTIONAR_MES");
  if (forbidden) return jsonForbidden();

  const body = await request.json().catch(() => null);
  const parsed = mesReposicionCreateSchema.safeParse(body);
  if (!parsed.success) return zodFirstErrorEnvelope(parsed.error);

  const data = parsed.data;
  const requestedBy = getEmployeeIdFromRequest(request);
  const requestingProcess = toProcess(data.requestingProcess);

  // ─── Verificar duplicidad antes de insertar ────────────────────────────────
  // Si ya existe una reposición activa (ABIERTA o EN_PROCESO) con los mismos
  // orderId + orderItemId + causeCode + requestingProcess, se rechaza la nueva.
  const duplicateConditions = [
    eq(mesReposiciones.orderId, data.orderId),
    eq(mesReposiciones.orderItemId, data.orderItemId),
    eq(mesReposiciones.causeCode, data.causeCode as any),
    inArray(mesReposiciones.status, ["ABIERTA", "EN_PROCESO"]),
  ];
  if (requestingProcess) {
    duplicateConditions.push(eq(mesReposiciones.requestingProcess, requestingProcess));
  } else {
    duplicateConditions.push(sql`${mesReposiciones.requestingProcess} IS NULL`);
  }

  const [duplicate] = await mesDb
    .select()
    .from(mesReposiciones)
    .where(and(...duplicateConditions))
    .limit(1);

  if (duplicate) {
    return jsonError(
      409,
      "DUPLICATE_REPOSITION",
      `Ya existe una reposición activa para este diseño con la misma causa${requestingProcess ? ` en el proceso ${requestingProcess}` : ""}. Código: ${duplicate.repositionCode}.`,
      {
        orderItemId: ["Ya existe una reposición activa para este diseño."],
        causeCode: ["La causa ya fue reportada en una reposición activa."],
        ...(requestingProcess
          ? { requestingProcess: ["El proceso ya tiene una reposición activa con esta causa."] }
          : {}),
      },
    );
  }

  // Genera código único con reintentos en caso de colisión
  let repositionCode = generateRepositionCode();
  let retries = 0;

  while (retries < 3) {
    const existing = await mesDb
      .select({ id: mesReposiciones.id })
      .from(mesReposiciones)
      .where(eq(mesReposiciones.repositionCode, repositionCode))
      .limit(1);

    if (!existing.length) break;
    await new Promise((r) => setTimeout(r, 10));
    repositionCode = generateRepositionCode();
    retries++;
  }

  const insertResult = await mesDb
    .insert(mesReposiciones)
    .values({
      repositionCode,
      orderId: data.orderId,
      orderItemId: data.orderItemId,
      causeCode: data.causeCode as any,
      requestingProcess,
      quantityRequested: data.quantityRequested ?? 1,
      notes: toStr(data.notes),
      requestedBy: requestedBy ?? undefined,
      status: "ABIERTA",
    })
    .returning()
    .catch((e) => dbJsonError(e, "No se pudo crear la reposición."));

  if (insertResult instanceof Response) return insertResult;
  const created = insertResult?.[0];
  if (!created) return jsonError(500, "INTERNAL", "Error al crear la reposición.", {});

  return Response.json({ ok: true, data: created }, { status: 201 });
}
