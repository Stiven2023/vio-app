import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  operativeDashboardLogs,
  orderItemPackaging,
  orderItemSocks,
  orderItemStatusHistory,
  orderItems,
  orders,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { rateLimit } from "@/src/utils/rate-limit";

const DASHBOARD_ROLES = new Set([
  "ADMINISTRADOR",
  "EMPAQUE",
  "CONFECCIONISTA",
  "MENSAJERO",
  "OPERARIO_BODEGA",
  "OPERARIO_INTEGRACION_CALIDAD",
  "OPERARIO_CORTE_LASER",
  "OPERARIO_CORTE_MANUAL",
  "OPERARIO_FLOTER",
  "OPERARIO_DESPACHO",
  "OPERARIO_MONTAJE",
  "OPERARIO_SUBLIMACION",
]);

const ROLE_AREAS = ["OPERARIOS", "CONFECCIONISTAS", "MENSAJERIA", "EMPAQUE"] as const;
const OPERATION_TYPES = [
  "PLOTTER",
  "CALANDRA",
  "CORTE_LASER",
  "CORTE_MANUAL",
  "INTEGRACION",
  "DESPACHO",
] as const;
const PROCESS_CODES = ["P", "S", "C"] as const;

function normalizeRoleArea(v: unknown) {
  if (v === undefined) return undefined;
  if (v === null || String(v).trim() === "") return null;

  const raw = String(v ?? "").trim().toUpperCase();
  if (ROLE_AREAS.includes(raw as (typeof ROLE_AREAS)[number])) {
    return raw as (typeof ROLE_AREAS)[number];
  }

  return "INVALID" as const;
}

function normalizeOperationType(v: unknown) {
  if (v === undefined) return undefined;
  if (v === null || String(v).trim() === "") return null;

  const raw = String(v ?? "").trim().toUpperCase();
  if (OPERATION_TYPES.includes(raw as (typeof OPERATION_TYPES)[number])) {
    return raw as (typeof OPERATION_TYPES)[number];
  }

  return "INVALID" as const;
}

function normalizeProcessCode(v: unknown) {
  if (v === undefined) return undefined;
  if (v === null || String(v).trim() === "") return null;

  const raw = String(v ?? "").trim().toUpperCase();
  if (PROCESS_CODES.includes(raw as (typeof PROCESS_CODES)[number])) {
    return raw as (typeof PROCESS_CODES)[number];
  }

  return "INVALID" as const;
}

function parseNonNegativeInt(v: unknown) {
  if (v === undefined) return undefined;
  const n = Number(String(v ?? "0").trim());
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function parseDateTime(v: unknown) {
  if (v === undefined) return undefined;
  if (v === null || String(v).trim() === "") return null;
  const date = new Date(String(v));
  if (Number.isNaN(date.getTime())) return "INVALID" as const;
  return date;
}

function toOptionalText(v: unknown) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const text = String(v).trim();
  return text ? text : null;
}

function toBoolean(v: unknown) {
  if (v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  const raw = String(v ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "si" || raw === "sí";
}

function normalizeMatchText(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

async function resolveOrderItemByDesignAndSize(args: {
  tx: any;
  orderCode: string;
  designName: string;
  size: string | null;
}) {
  const orderCode = String(args.orderCode ?? "").trim();
  const designName = normalizeMatchText(args.designName);
  const size = normalizeMatchText(args.size);

  if (!orderCode || !designName) return null;

  const candidates = await args.tx
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.orderCode, orderCode),
        sql`lower(trim(coalesce(${orderItems.name}, ''))) = ${designName}`,
      ),
    )
    .limit(20);

  if (!candidates.length) return null;
  if (!size) return candidates[0];

  const ids = candidates.map((candidate: { id: string }) => candidate.id);
  const packagingMatches = await args.tx
    .select({ orderItemId: orderItemPackaging.orderItemId })
    .from(orderItemPackaging)
    .where(
      and(
        inArray(orderItemPackaging.orderItemId, ids),
        sql`lower(trim(coalesce(${orderItemPackaging.size}, ''))) = ${size}`,
      ),
    );

  const socksMatches = await args.tx
    .select({ orderItemId: orderItemSocks.orderItemId })
    .from(orderItemSocks)
    .where(
      and(
        inArray(orderItemSocks.orderItemId, ids),
        sql`lower(trim(coalesce(${orderItemSocks.size}, ''))) = ${size}`,
      ),
    );

  const allowedIds = new Set(
    [...packagingMatches, ...socksMatches]
      .map((row) => String(row.orderItemId ?? "").trim())
      .filter(Boolean),
  );

  if (!allowedIds.size) return null;

  return candidates.find((candidate: { id: string }) => allowedIds.has(String(candidate.id))) ?? null;
}

async function verifyAccess(request: Request, id: string) {
  const role = getRoleFromRequest(request);
  if (!role || !DASHBOARD_ROLES.has(role)) {
    return { error: new Response("Forbidden", { status: 403 }) } as const;
  }

  const [existing] = await db
    .select()
    .from(operativeDashboardLogs)
    .where(eq(operativeDashboardLogs.id, id))
    .limit(1);

  if (!existing) {
    return { error: new Response("Not found", { status: 404 }) } as const;
  }

  const userId = getUserIdFromRequest(request);

  if (role !== "ADMINISTRADOR" && existing.createdByUserId && existing.createdByUserId !== userId) {
    return { error: new Response("Forbidden", { status: 403 }) } as const;
  }

  return { existing, role, userId } as const;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "dashboard:operative-logs:put",
    limit: 180,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { id } = await params;
  const recordId = String(id ?? "").trim();

  if (!recordId) return new Response("id requerido", { status: 400 });

  const access = await verifyAccess(request, recordId);
  if (access.error) return access.error;

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Partial<typeof operativeDashboardLogs.$inferInsert> = {};

  const roleArea = normalizeRoleArea(body.roleArea);
  if (roleArea === "INVALID") return new Response("roleArea inválido", { status: 400 });
  if (roleArea !== undefined && roleArea !== null) patch.roleArea = roleArea;

  const operationType = normalizeOperationType(body.operationType);
  if (operationType === "INVALID") {
    return new Response("operationType inválido", { status: 400 });
  }
  if (operationType !== undefined) patch.operationType = operationType;

  const processCode = normalizeProcessCode(body.processCode);
  if (processCode === "INVALID") return new Response("processCode inválido", { status: 400 });
  if (processCode !== undefined && processCode !== null) {
    patch.processCode = processCode;
  }

  if (body.orderCode !== undefined) {
    const orderCode = String(body.orderCode ?? "").trim();
    if (!orderCode) return new Response("orderCode es requerido", { status: 400 });
    patch.orderCode = orderCode;
  }

  if (body.designName !== undefined) {
    const designName = String(body.designName ?? "").trim();
    if (!designName) return new Response("designName es requerido", { status: 400 });
    patch.designName = designName;
  }

  const quantityOp = parseNonNegativeInt(body.quantityOp);
  if (quantityOp === null) return new Response("quantityOp inválido", { status: 400 });
  if (quantityOp !== undefined) patch.quantityOp = quantityOp;

  const producedQuantity = parseNonNegativeInt(body.producedQuantity);
  if (producedQuantity === null) {
    return new Response("producedQuantity inválido", { status: 400 });
  }
  if (producedQuantity !== undefined) patch.producedQuantity = producedQuantity;

  const startAt = parseDateTime(body.startAt);
  if (startAt === "INVALID") return new Response("startAt inválido", { status: 400 });
  if (startAt !== undefined) patch.startAt = startAt;

  const endAt = parseDateTime(body.endAt);
  if (endAt === "INVALID") return new Response("endAt inválido", { status: 400 });
  if (endAt !== undefined) patch.endAt = endAt;

  const details = toOptionalText(body.details);
  if (details !== undefined) patch.details = details;

  const size = toOptionalText(body.size);
  if (size !== undefined) patch.size = size;

  const observations = toOptionalText(body.observations);
  if (observations !== undefined) patch.observations = observations;

  const isComplete = toBoolean(body.isComplete);
  if (isComplete !== undefined) patch.isComplete = isComplete;

  const isPartial = toBoolean(body.isPartial);
  if (isPartial !== undefined) patch.isPartial = isPartial;

  const repoCheck = toBoolean(body.repoCheck);
  if (repoCheck !== undefined) patch.repoCheck = repoCheck;

  patch.updatedAt = new Date();

  if (Object.keys(patch).length === 1 && patch.updatedAt) {
    return new Response("No fields to update", { status: 400 });
  }

  try {
    const [updated] = await db
      .update(operativeDashboardLogs)
      .set(patch)
      .where(eq(operativeDashboardLogs.id, recordId))
      .returning();

    return Response.json(updated);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo actualizar registro operativo", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "dashboard:operative-logs:delete",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { id } = await params;
  const recordId = String(id ?? "").trim();

  if (!recordId) return new Response("id requerido", { status: 400 });

  const access = await verifyAccess(request, recordId);
  if (access.error) return access.error;

  try {
    const [deleted] = await db
      .delete(operativeDashboardLogs)
      .where(eq(operativeDashboardLogs.id, recordId))
      .returning();

    return Response.json(deleted);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo eliminar registro operativo", { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "dashboard:operative-logs:reposition",
    limit: 80,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { id } = await params;
  const recordId = String(id ?? "").trim();

  if (!recordId) return new Response("id requerido", { status: 400 });

  const access = await verifyAccess(request, recordId);
  if (access.error) return access.error;

  const source = access.existing;
  if (!source.isPartial) {
    return new Response("Solo se puede crear reposición desde un registro parcial", {
      status: 400,
    });
  }

  const changedByEmployeeId = await getEmployeeIdFromRequest(request);
  const remainingQuantity = Math.max(0, Number(source.quantityOp ?? 0) - Number(source.producedQuantity ?? 0));

  try {
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(operativeDashboardLogs)
        .values({
          roleArea: source.roleArea,
          operationType: source.operationType,
          orderCode: source.orderCode,
          designName: source.designName,
          details: source.details,
          size: source.size,
          quantityOp: remainingQuantity > 0 ? remainingQuantity : source.quantityOp,
          producedQuantity: 0,
          startAt: null,
          endAt: null,
          isComplete: false,
          isPartial: false,
          observations: source.observations
            ? `${source.observations} | Reposición automática desde registro parcial`
            : "Reposición automática desde registro parcial",
          repoCheck: true,
          processCode: source.processCode,
          createdByUserId: access.userId,
        })
        .returning();

      const linkedItem = await resolveOrderItemByDesignAndSize({
        tx,
        orderCode: source.orderCode,
        designName: source.designName,
        size: source.size,
      });

      if (linkedItem?.id) {
        await tx
          .update(orderItems)
          .set({ status: "EN_REVISION_CAMBIO" })
          .where(eq(orderItems.id, linkedItem.id));

        await tx.insert(orderItemStatusHistory).values({
          orderItemId: linkedItem.id,
          status: "EN_REVISION_CAMBIO",
          changedBy: changedByEmployeeId,
        });
      }

      return {
        ...created,
        linkedOrderItemId: linkedItem?.id ?? null,
      };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo crear reposición automática", { status: 500 });
  }
}
